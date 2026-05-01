export type ReplaceEngine = 'regex' | 'text' | 'wildcard';

export type MapReplaceMode = 'text' | 'regex';

export type MapReplaceItem = {
  find: string;
  replace: string;
};

export type MapReplaceConfig = {
  mode: MapReplaceMode;
  cases: MapReplaceItem[];
};

export type ReplaceRule = {
  engine: ReplaceEngine;
  find: string;
  replace: string;
  /** 替换模式：template 使用 replace；map 使用 map 对捕获组 $1..$n 做 cases 匹配，并将命中的组替换回主匹配片段。 */
  replaceMode?: 'template' | 'map';
  /**
   * 映射表（自上而下优先匹配）：先用 find+flags 找到主匹配片段，再按 $1..$n 顺序对捕获组文本扫描 cases，
   * 仅应用第一条能匹配的规则，并将结果写回到主匹配片段中。
   */
  map?: MapReplaceConfig;
  flags?: string;
  wildcardOptions?: { dotAll?: boolean };
};

export type MatchItem = {
  index: number;
  startOffset: number;
  endOffset: number;
  matchText: string;
  groups: string[];
};

export type ComputeMatchesOptions = {
  maxMatches: number;
};

/**
 * 根据当前规则与测试文本计算所有匹配项（用于高亮与 List）。
 *
 * @param rule 当前选中规则。
 * @param text 测试文本。
 * @param opts 计算选项（最大匹配数上限）。
 * @returns 匹配结果数组；若规则非法则抛出错误。
 */
export function computeMatches(rule: ReplaceRule, text: string, opts: ComputeMatchesOptions): MatchItem[] {
  if (!text) return [];
  if (!rule.find) return [];
  const re = buildSearchRegex(rule);
  const max = Math.max(0, opts.maxMatches);

  const items: MatchItem[] = [];
  let m: RegExpExecArray | null;
  let idx = 0;

  while ((m = re.exec(text)) !== null) {
    const matchText = m[0] ?? '';
    const start = m.index ?? 0;
    const end = start + matchText.length;

    items.push({
      index: idx,
      startOffset: start,
      endOffset: end,
      matchText,
      groups: m.slice(1).map((v) => String(v ?? '')),
    });

    idx += 1;
    if (idx >= max) break;

    // 空匹配会导致 lastIndex 不前进，必须手动推进避免死循环
    if (matchText.length === 0) {
      re.lastIndex += 1;
      if (re.lastIndex > text.length) break;
    }
  }

  return items;
}

/**
 * 将规则转换为“用于搜索所有匹配”的正则。
 *
 * @param rule 替换规则。
 * @returns RegExp 实例（总是包含 g）。
 */
export function buildSearchRegex(rule: ReplaceRule): RegExp {
  if (rule.engine === 'regex') {
    const flags = normalizeFlags(rule.flags ?? 'g', { forceGlobal: true });
    return new RegExp(rule.find, flags);
  }

  if (rule.engine === 'text') {
    const src = escapeRegexLiteral(rule.find);
    return new RegExp(src, 'g');
  }

  const dotAll = Boolean(rule.wildcardOptions?.dotAll);
  const src = wildcardToRegexSource(rule.find, dotAll);
  const flags = normalizeFlags('g' + (dotAll ? 's' : ''), { forceGlobal: true });
  return new RegExp(src, flags);
}

type NormalizeFlagsOptions = {
  forceGlobal: boolean;
};

/**
 * 规范化 flags：去重、过滤非法，并可强制包含 g。
 *
 * @param flags 原始 flags。
 * @param opts 选项。
 * @returns 规范化后的 flags。
 */
export function normalizeFlags(flags: string, opts: NormalizeFlagsOptions): string {
  const allowed = new Set(['g', 'i', 'm', 's', 'u', 'y', 'd']);
  const out: string[] = [];
  for (const ch of flags) {
    if (!allowed.has(ch)) continue;
    if (out.includes(ch)) continue;
    out.push(ch);
  }
  if (opts.forceGlobal && !out.includes('g')) out.unshift('g');
  return out.join('') || 'g';
}

/**
 * 将文本按“字面量”转义成正则安全字符。
 *
 * @param text 要转义的文本。
 * @returns 转义后的文本。
 */
export function escapeRegexLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 将通配符表达式转换为 JavaScript 正则源码。
 *
 * @param pattern 通配符表达式，支持 `*`、`?`、`\\n`，以及 `\\*`、`\\?` 转义。
 * @param dotAll 是否允许 `*` 与 `?` 匹配换行。
 * @returns 正则源码（不含 `/.../`）。
 */
export function wildcardToRegexSource(pattern: string, dotAll: boolean): string {
  const anyChar = dotAll ? '[\\s\\S]' : '[^\\n]';
  let out = '';

  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '\\') {
      const next = pattern[i + 1];
      if (next === 'n') {
        out += '\\n';
        i += 1;
        continue;
      }
      if (next === '*' || next === '?') {
        out += escapeRegexLiteral(next);
        i += 1;
        continue;
      }
      out += '\\\\';
      continue;
    }

    if (ch === '*') {
      out += `${anyChar}*`;
      continue;
    }
    if (ch === '?') {
      out += anyChar;
      continue;
    }

    out += escapeRegexLiteral(ch);
  }

  return out;
}

