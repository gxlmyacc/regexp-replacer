import type { ReplaceRule } from '../tester/matchHighlighter';
import { buildSearchRegex } from '../tester/matchHighlighter';
import {
  applyMapFirstMatchToFragment,
  decodeEscapedReplacementTemplate,
  expandReplacementTemplate,
} from '../../../../src/replace/engines';

export type ReplacePreviewResult = {
  replacedCount: number;
  previewText: string;
  previewParts: { text: string; replaced: boolean }[];
  fullText: string;
};

export type ReplacePreviewOptions = {
  maxPreviewChars: number;
  /**
   * 为 false 时不收集 `previewParts`（仍生成 `previewText` / `fullText`），大文本下可减少对象分配。
   * 默认 true。
   */
  collectHighlightParts?: boolean;
};

/**
 * 基于当前规则与替换模板生成替换预览结果。
 *
 * @param rule 当前规则。
 * @param input 输入文本。
 * @param replacementTemplate 替换模板（String.replace 语法）。
 * @param opts 预览选项（最大预览字符数、是否生成分段高亮数据）。
 * @returns 预览结果（包含全量与截断预览）。
 */
export function computeReplacePreview(
  rule: ReplaceRule,
  input: string,
  replacementTemplate: string,
  opts: ReplacePreviewOptions,
): ReplacePreviewResult {
  const maxChars = Math.max(0, opts.maxPreviewChars);
  const collectHighlightParts = opts.collectHighlightParts !== false;

  // 空文本或空表达式时不做替换预览，避免空匹配导致性能问题或“全被替换为空”的误导。
  const find = (rule.find ?? '').toString();
  if (!input || !find) {
    const previewText = input.length <= maxChars ? input : `${input.slice(0, maxChars)}…`;
    const previewParts =
      collectHighlightParts && previewText ? [{ text: previewText, replaced: false }] : [];
    return { replacedCount: 0, previewText, previewParts, fullText: input };
  }

  const re = buildSearchRegex(rule);

  let replacedCount = 0;
  let truncated = false;
  let outLen = 0;
  let lastIdx = 0;
  let previewTextAcc = '';

  const fullParts: string[] = [];
  const previewParts: { text: string; replaced: boolean }[] = [];

  /**
   * 计算当前匹配项的替换文本：template 使用 replacementTemplate；map 仅对捕获组 $1..$n 做 cases 匹配，并把命中的组替换回 match 片段。
   *
   * @param match 整段匹配文本（$&）。
   * @param groups 捕获组列表（groups[0] 为 $1）。
   * @param ctxTemplate 替换模板上下文。
   * @returns 替换后的文本与“是否发生变化”。
   */
  function computeReplacement(
    match: string,
    groups: string[],
    ctxTemplate: Parameters<typeof expandReplacementTemplate>[1],
  ): { replacement: string; changed: boolean } {
    if ((rule.replaceMode ?? 'template') !== 'map') {
      if (rule.engine === 'text') {
        const replacement = decodeEscapedReplacementTemplate(replacementTemplate).replace(/\$\$/g, '$');
        return { replacement, changed: true };
      }
      const replacement = expandReplacementTemplate(replacementTemplate, ctxTemplate);
      return { replacement, changed: true };
    }
    if (rule.engine !== 'regex') return { replacement: match, changed: false };
    const map = rule.map;
    if (!map || !Array.isArray(map.cases) || map.cases.length === 0) return { replacement: match, changed: false };

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

    const mapConfig = {
      mode: map.mode,
      cases: map.cases.map((it) => ({ find: String(it.find ?? ''), replace: String(it.replace ?? '') })),
    };

    // 映射模式：仅对捕获组 $1..$n 做 cases 匹配；命中后把 match 内该组第一次出现的片段替换为映射结果。
    for (const g of groups) {
      if (!g) continue;
      const res = applyMapFirstMatchToFragment(g, mapConfig);
      if (!res.changed) continue;
      return { replacement: replaceFirstOccurrence(match, g, res.text), changed: true };
    }
    return { replacement: match, changed: false };
  }

  /**
   * 追加一段文本到 previewParts（会按 maxChars 截断）。
   *
   * @param text 文本片段。
   * @param replaced 是否为“替换生成”的片段。
   * @returns 无返回值。
   */
  function pushPreview(text: string, replaced: boolean): void {
    if (!text) return;
    if (truncated) return;
    const remain = maxChars - outLen;
    if (remain <= 0) {
      truncated = true;
      return;
    }
    const slice = text.length <= remain ? text : text.slice(0, remain);
    if (slice) {
      previewTextAcc += slice;
      if (collectHighlightParts) previewParts.push({ text: slice, replaced });
    }
    outLen += slice.length;
    if (text.length > remain) truncated = true;
  }

  // 使用 String.replace 的扫描结果来构造分段预览，避免手动 exec/lastIndex 细节导致差异。
  input.replace(re, (...args) => {
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

    const before = whole.slice(lastIdx, offset);
    const { replacement, changed } = computeReplacement(match, groups, {
      match,
      groups,
      offset,
      input: whole,
      namedGroups,
    });
    if ((rule.replaceMode ?? 'template') !== 'map') {
      replacedCount += 1;
    } else if (changed) {
      replacedCount += 1;
    }

    fullParts.push(before, replacement);
    pushPreview(before, false);
    const highlightAsReplaced = (rule.replaceMode ?? 'template') !== 'map' ? true : changed;
    pushPreview(replacement, highlightAsReplaced);

    lastIdx = offset + match.length;
    return replacement;
  });

  const tail = input.slice(lastIdx);
  fullParts.push(tail);
  pushPreview(tail, false);

  if (truncated) pushPreview('…', false);

  const fullText = fullParts.join('');
  const previewText = previewTextAcc;

  return { replacedCount, previewText, previewParts, fullText };
}
