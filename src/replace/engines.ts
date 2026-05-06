import type { ReplaceRule } from '../types';
import { escapeRegexLiteral, wildcardToRegexSource } from './wildcard';
import { validateMapRuleOrThrow } from './ruleValidation';

export interface ApplyRuleResult {
  text: string;
  replacedCount: number;
}

/**
 * 对输入文本应用一条替换规则，并返回替换后的文本与替换次数。
 *
 * @param input 输入文本。
 * @param rule 替换规则（regex/text/wildcard）。
 * @returns 替换结果，包含替换后的文本与替换次数。
 */
export function applyRule(input: string, rule: ReplaceRule): ApplyRuleResult {
  const normalized: ReplaceRule = {
    ...rule,
    find: (rule.find ?? '').toString(),
    replace: (rule.replace ?? '').toString(),
    flags: (rule.flags ?? 'g').toString(),
  };
  validateMapRuleOrThrow(normalized);

  switch (normalized.engine) {
    case 'regex':
      return (normalized.replaceMode ?? 'template') === 'map'
        ? applyRegexMapListRule(input, normalized.find, normalized.flags ?? 'g', normalized.map!)
        : applyRegexRule(input, normalized.find, normalized.replace, normalized.flags ?? 'g');
    case 'text':
      return applyTextRule(input, normalized.find, normalized.replace);
    case 'wildcard': {
      const dotAll = Boolean(normalized.wildcardOptions?.dotAll);
      const src = wildcardToRegexSource(normalized.find, dotAll);
      return applyRegexRule(input, src, normalized.replace, 'g' + (dotAll ? 's' : ''));
    }
    default: {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const _exhaustive: never = normalized.engine;
      return _exhaustive;
    }
  }
}

/**
 * 使用正则表达式执行替换，并统计替换次数。
 *
 * @param input 输入文本。
 * @param source 正则源码（不含 /.../）。
 * @param replacement 替换模板（String.replace 语法）。
 * @param flags 正则 flags；若未包含 g，则也会正确统计次数但仅替换一次。
 * @returns 替换结果，包含替换后的文本与替换次数。
 */
export function applyRegexRule(
  input: string,
  source: string,
  replacement: string,
  flags: string,
): ApplyRuleResult {
  const re = new RegExp(source, flags);

  let replacedCount = 0;
  const text = input.replace(re, (...args) => {
    // args: match, ...groups, offset, input, namedGroups?
    replacedCount += 1;

    const maybeGroups = args[args.length - 1];
    const hasNamedGroups =
      typeof maybeGroups === 'object' &&
      maybeGroups !== null &&
      !Array.isArray(maybeGroups) &&
      typeof args[args.length - 2] === 'string';

    const match = String(args[0]);
    const offset = Number(args[hasNamedGroups ? args.length - 3 : args.length - 2]);
    const whole = String(args[hasNamedGroups ? args.length - 2 : args.length - 1]);
    const groups = args
      .slice(1, hasNamedGroups ? args.length - 3 : args.length - 2)
      .map((v) => String(v ?? ''));
    const namedGroups = hasNamedGroups ? (maybeGroups as Record<string, string>) : undefined;

    return expandReplacementTemplate(replacement, {
      match,
      groups,
      offset,
      input: whole,
      namedGroups,
    });
  });

  return { text, replacedCount };
}

/**
 * 对给定文本片段应用映射表 cases：**自上而下选用第一条能在片段内匹配的规则**，仅执行该条替换（其后条目忽略）。
 *
 * @param fragment 要被映射表处理的文本片段（可能来自捕获组或其它片段）。
 * @param mapConfig 映射表配置（text/regex + cases）。
 * @returns 替换后的片段与是否发生变化。
 */
export function applyMapFirstMatchToFragment(
  fragment: string,
  mapConfig: NonNullable<ReplaceRule['map']>,
): { text: string; changed: boolean } {
  for (const it of mapConfig.cases ?? []) {
    const find = String(it?.find ?? '');
    const replace = String(it?.replace ?? '');
    if (!find) continue;

    if (mapConfig.mode === 'regex') {
      let matched = false;
      try {
        const probe = new RegExp(find, 'g');
        matched = probe.test(fragment);
      } catch {
        continue;
      }
      if (!matched) continue;
      const out = applyRegexRule(fragment, find, replace, 'g').text;
      return { text: out, changed: out !== fragment };
    }

    if (!fragment.includes(find)) continue;
    const out = applyTextRule(fragment, find, replace).text;
    return { text: out, changed: out !== fragment };
  }
  return { text: fragment, changed: false };
}

/**
 * 使用正则表达式执行“映射模式”替换：先用主规则匹配出片段，再仅对捕获组 $1..$n（按顺序）做映射匹配并将结果写回片段。
 *
 * @param input 输入文本。
 * @param source 正则源码（不含 /.../）。
 * @param flags 正则 flags。
 * @param mapConfig 映射表配置（text/regex + cases）。
 * @returns 替换结果，包含替换后的文本与替换次数（仅在文本发生变化时计数）。
 */
export function applyRegexMapListRule(
  input: string,
  source: string,
  flags: string,
  mapConfig: NonNullable<ReplaceRule['map']>,
): ApplyRuleResult {
  const re = new RegExp(source, flags);
  let replacedCount = 0;
  const text = input.replace(re, (...args) => {
    const maybeGroups = args[args.length - 1];
    const hasNamedGroups =
      typeof maybeGroups === 'object' &&
      maybeGroups !== null &&
      !Array.isArray(maybeGroups) &&
      typeof args[args.length - 2] === 'string';

    const match = String(args[0]);
    const groups = args
      .slice(1, hasNamedGroups ? args.length - 3 : args.length - 2)
      .map((v) => String(v ?? ''));

    /**
     * 将字符串中第一次出现的子串替换为指定文本。
     *
     * @param whole 原字符串。
     * @param needle 要替换的子串。
     * @param replacement 替换文本。
     * @returns 替换后的字符串；若未找到则返回 whole。
     */
    function replaceFirstOccurrence(whole: string, needle: string, replacement: string): string {
      if (!needle) return whole;
      const idx = whole.indexOf(needle);
      if (idx < 0) return whole;
      return `${whole.slice(0, idx)}${replacement}${whole.slice(idx + needle.length)}`;
    }

    // 映射模式：仅对捕获组 $1..$n 做 cases 匹配；命中后把 match 内该组第一次出现的片段替换为映射结果。
    for (const g of groups) {
      if (!g) continue;
      const res = applyMapFirstMatchToFragment(g, mapConfig);
      if (!res.changed) continue;
      replacedCount += 1;
      return replaceFirstOccurrence(match, g, res.text);
    }
    return match;
  });
  return { text, replacedCount };
}

/**
 * 以“纯文本查找”方式执行全局替换，并统计替换次数。
 *
 * @param input 输入文本。
 * @param find 要查找的文本。
 * @param replacement 替换模板（String.replace 语法；在 text 模式下仅 $$ 有意义，其他 $ 视为字面量）。
 * @returns 替换结果，包含替换后的文本与替换次数。
 */
export function applyTextRule(input: string, find: string, replacement: string): ApplyRuleResult {
  if (find.length === 0) return { text: input, replacedCount: 0 };
  const re = new RegExp(escapeRegexLiteral(find), 'g');

  let replacedCount = 0;
  const safeReplacement = decodeEscapedReplacementTemplate(replacement).replace(/\$\$/g, '$');
  const text = input.replace(re, () => {
    replacedCount += 1;
    return safeReplacement;
  });

  return { text, replacedCount };
}

type ReplacementContext = {
  match: string;
  groups: string[];
  offset: number;
  input: string;
  namedGroups?: Record<string, string>;
};

/**
 * 将 replacement 模板按与 UI 高亮一致的规则展开：`$` 后 1～2 位数字仅在组号落在当前匹配实际捕获组数量内时替换，否则退回更短匹配（如仅 `$1`）或保留字面 `$`。
 * 特殊占位仍为 `$& $` $' $$ $<name>`（与原先一致）。
 *
 * @param template 替换模板字符串。
 * @param ctx 替换上下文（match、分组、offset、原始输入等）；`groups.length` 为当前匹配捕获组个数。
 * @returns 展开后的替换字符串。
 */
export function expandReplacementTemplate(template: string, ctx: ReplacementContext): string {
  const s = decodeEscapedReplacementTemplate(template);
  const maxN = Math.min(99, Math.max(0, ctx.groups.length));
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch !== '$') {
      out += ch;
      i += 1;
      continue;
    }
    const next = s[i + 1];
    if (next === undefined) {
      out += '$';
      i += 1;
      continue;
    }
    if (next === '$') {
      out += '$';
      i += 2;
      continue;
    }
    if (next === '&') {
      out += ctx.match;
      i += 2;
      continue;
    }
    if (next === '`') {
      out += ctx.input.slice(0, ctx.offset);
      i += 2;
      continue;
    }
    if (next === "'") {
      out += ctx.input.slice(ctx.offset + ctx.match.length);
      i += 2;
      continue;
    }
    if (next === '<') {
      const end = s.indexOf('>', i + 2);
      if (end > i + 2) {
        const name = s.slice(i + 2, end);
        out += ctx.namedGroups?.[name] ?? '';
        i = end + 1;
        continue;
      }
    }
    if (next && /\d/.test(next) && maxN >= 1) {
      const next2 = s[i + 2];
      if (next2 && /\d/.test(next2)) {
        const twoVal = Number.parseInt(`${next}${next2}`, 10);
        if (twoVal >= 1 && twoVal <= maxN) {
          out += ctx.groups[twoVal - 1] ?? '';
          i += 3;
          continue;
        }
      }
      const oneVal = Number.parseInt(next, 10);
      if (oneVal >= 1 && oneVal <= maxN) {
        out += ctx.groups[oneVal - 1] ?? '';
        i += 2;
        continue;
      }
    }
    out += '$';
    i += 1;
  }
  return out;
}

/**
 * 解析替换模板中的常见转义序列，兼容 VSCode 正则替换输入习惯。
 *
 * @param template 用户输入的替换模板文本。
 * @returns 解析后的模板文本（如 `\\n` -> 换行、`\\t` -> 制表符）。
 */
export function decodeEscapedReplacementTemplate(template: string): string {
  let out = '';
  for (let i = 0; i < template.length; i += 1) {
    const ch = template[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = template[i + 1];
    if (next === undefined) {
      out += '\\';
      continue;
    }
    if (next === 'n') {
      out += '\n';
      i += 1;
      continue;
    }
    if (next === 'r') {
      out += '\r';
      i += 1;
      continue;
    }
    if (next === 't') {
      out += '\t';
      i += 1;
      continue;
    }
    if (next === '\\') {
      out += '\\';
      i += 1;
      continue;
    }
    out += `\\${next}`;
    i += 1;
  }
  return out;
}

