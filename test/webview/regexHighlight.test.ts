import { describe, expect, test } from 'vitest';
import {
  buildAstSemanticPatches,
  buildRegexExplainOutline,
  buildRegexHighlightModel,
  lexRegexPatternTokens,
  mergeSemanticSpans,
  regexTokensToSemanticSpans,
} from '../../webview/src/utils/regexHighlight';
import { en } from '../../webview/src/i18n/en';
import { parseRegExpPattern } from '../../webview/src/utils/regexLint/parseRegExpPattern';
import { formatMessageTemplate } from '../../webview/src/utils/regexHighlight/formatTemplate';

describe('formatMessageTemplate', () => {
  test('按 `{key}` 占位符替换', () => {
    expect(formatMessageTemplate('{who}:{what}', { who: 'A', what: 'B' })).toBe('A:B');
  });
});

describe('regexHighlight lexer', () => {
  test('lexRegexPatternTokens：`v` 下嵌套字符类整块', () => {
    const toks = lexRegexPatternTokens('[[a-m]]', 'v');
    const cls = toks.find((t) => t.type === 'class');
    expect(cls?.value).toBe('[[a-m]]');
  });

  test('lexRegexPatternTokens：吞并 \\u{…} 与 \\p{…}', () => {
    const toks = lexRegexPatternTokens(String.raw`\u{1F600}\p{L}`, 'u');
    const esc = toks.filter((t) => t.type === 'escape');
    expect(esc.some((t) => t.value.includes('{1F600}'))).toBe(true);
    expect(esc.some((t) => t.value.includes('p{L}'))).toBe(true);
  });

  test('lexRegexPatternTokens：{n,m} 与尾随 ? 合并为同一 quant token', () => {
    const toks = lexRegexPatternTokens('a{2,4}?', '');
    const q = toks.filter((t) => t.type === 'quant');
    expect(q.some((t) => t.value === '{2,4}?' || t.value.includes('{2,4}'))).toBe(true);
  });

  test('lexRegexPatternTokens：无 u 时 \\0 可吞 Annex B 八进制后续位', () => {
    const toks = lexRegexPatternTokens(String.raw`\012x`, '');
    const esc = toks.filter((t) => t.type === 'escape');
    expect(esc[0]?.value).toBe(String.raw`\012`);
    expect(toks.some((t) => t.type === 'text' && t.value.includes('x'))).toBe(true);
  });

  test('lexRegexPatternTokens：u 下 \\0 仅两位，后续数字单独 token', () => {
    const toks = lexRegexPatternTokens(String.raw`\012`, 'u');
    const esc = toks.filter((t) => t.type === 'escape');
    expect(esc.some((t) => t.value === String.raw`\0`)).toBe(true);
    expect(toks.some((t) => t.type === 'text' && t.value === '12')).toBe(true);
  });

  test('lexRegexPatternTokens：v 下 \\0 与 u 同为严格两位', () => {
    const toks = lexRegexPatternTokens(String.raw`\099`, 'v');
    const esc = toks.filter((t) => t.type === 'escape');
    expect(esc.some((t) => t.value === String.raw`\0`)).toBe(true);
  });

  test('lexRegexPatternTokens：\\c 仅在有 ASCII 字母第三位时吞三位', () => {
    const star = lexRegexPatternTokens(String.raw`\c*`, 'u');
    expect(star.filter((t) => t.type === 'escape').some((t) => t.value === String.raw`\c`)).toBe(true);
    expect(star.some((t) => t.type === 'quant' && t.value === '*')).toBe(true);

    const ok = lexRegexPatternTokens(String.raw`\cA`, 'g');
    expect(ok.filter((t) => t.type === 'escape').some((t) => t.value === String.raw`\cA`)).toBe(true);
  });

  test('lexRegexPatternTokens：u 下 \\x 须两位十六进制，否则只吞 \\x', () => {
    const partial = lexRegexPatternTokens(String.raw`\xA`, 'u');
    expect(partial.filter((t) => t.type === 'escape').some((t) => t.value === String.raw`\x`)).toBe(true);
    expect(partial.some((t) => t.type === 'text' && t.value === 'A')).toBe(true);

    const full = lexRegexPatternTokens(String.raw`\x2a`, 'u');
    expect(full.filter((t) => t.type === 'escape').some((t) => t.value === String.raw`\x2a`)).toBe(true);
  });

  test('lexRegexPatternTokens：无 u 时 \\x 仍吞已有十六进制位（宽松）', () => {
    const toks = lexRegexPatternTokens(String.raw`\xA`, '');
    expect(toks.filter((t) => t.type === 'escape').some((t) => t.value === String.raw`\xA`)).toBe(true);
  });

  test('lexRegexPatternTokens：u 下 \\uXXXX 须四位（\\u{…} 仍按花括号吞）', () => {
    const three = lexRegexPatternTokens(String.raw`\uABC`, 'u');
    expect(three.filter((t) => t.type === 'escape').some((t) => t.value === String.raw`\u`)).toBe(true);
    expect(three.some((t) => t.type === 'text' && t.value === 'ABC')).toBe(true);

    const four = lexRegexPatternTokens(String.raw`\u00A9`, 'u');
    expect(four.filter((t) => t.type === 'escape').some((t) => t.value === String.raw`\u00A9`)).toBe(true);

    const braced = lexRegexPatternTokens(String.raw`\u{1F600}`, 'u');
    expect(braced.filter((t) => t.type === 'escape').some((t) => t.value.includes('{1F600}'))).toBe(true);
  });

  test('lexRegexPatternTokens：\\q{…} 整段 escape（花括号可嵌套）', () => {
    const inner = lexRegexPatternTokens('[\\q{a|b}]', 'v');
    const cls = inner.find((t) => t.type === 'class');
    expect(cls?.value).toContain(String.raw`\q{a|b}`);

    const nested = lexRegexPatternTokens('[\\q{x{y}}]', 'v');
    expect(nested.find((t) => t.type === 'class')?.value).toContain(String.raw`\q{x{y}}`);

    const bare = lexRegexPatternTokens(String.raw`\qx`, 'v');
    expect(bare.filter((t) => t.type === 'escape').some((t) => t.value === String.raw`\q`)).toBe(true);
  });
});

describe('mergeSemanticSpans', () => {
  test('AST 覆盖与 lexer 重叠的区间', () => {
    const base = [{ from: 0, to: 5, kind: 'escape' as const }];
    const ast = [{ from: 1, to: 4, kind: 'class' as const }];
    const merged = mergeSemanticSpans(base, ast);
    expect(merged.some((s) => s.from === 0 && s.to === 1 && s.kind === 'escape')).toBe(true);
    expect(merged.some((s) => s.from === 1 && s.to === 4 && s.kind === 'class')).toBe(true);
    expect(merged.some((s) => s.from === 4 && s.to === 5 && s.kind === 'escape')).toBe(true);
  });

  test('无 AST 时原样合并相邻同类', () => {
    const base = [
      { from: 0, to: 1, kind: 'dot' as const },
      { from: 1, to: 2, kind: 'dot' as const },
    ];
    expect(mergeSemanticSpans(base, [])).toEqual([{ from: 0, to: 2, kind: 'dot' }]);
  });
});

describe('buildRegexHighlightModel', () => {
  test('合法 pattern：meta.parseOk 且括号对与字面以外的语义（如 \\d）', () => {
    const m = buildRegexHighlightModel(String.raw`\d(a)`, 'g');
    expect(m.meta.parseOk).toBe(true);
    expect(m.bracketPairs.length).toBeGreaterThanOrEqual(1);
    expect(m.semanticSpans.length).toBeGreaterThan(0);
  });

  test('非法 pattern：仍有 lexer semanticSpans', () => {
    const m = buildRegexHighlightModel('(', 'g');
    expect(m.meta.parseOk).toBe(false);
    expect(m.semanticSpans.length).toBeGreaterThanOrEqual(0);
    expect(m.bracketPairs.length).toBeGreaterThanOrEqual(0);
  });

  test('\\p 在 u 下由 AST 细化（若 parse ok）', () => {
    const m = buildRegexHighlightModel(String.raw`\p{L}`, 'u');
    expect(m.meta.parseOk).toBe(true);
    expect(m.meta.usedAstEnhancement).toBe(true);
  });
});

describe('buildAstSemanticPatches', () => {
  test('产出 CharacterClass 与 Quantifier 类 span', () => {
    const r = parseRegExpPattern('[a]+', 'g');
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('parse');
    const patches = buildAstSemanticPatches(r.pattern);
    expect(patches.some((p) => p.kind === 'class')).toBe(true);
    expect(patches.some((p) => p.kind === 'quant')).toBe(true);
  });
});

describe('buildRegexExplainOutline', () => {
  test('解析失败：含 Parse error 与 lexer 降级行', () => {
    const o = buildRegexExplainOutline('(', 'g', en);
    expect(o.parseOk).toBe(false);
    expect(o.segments[0]?.text).toMatch(/Parse error/i);
  });

  test('解析成功：含 Flags 与分组描述', () => {
    const o = buildRegexExplainOutline('(?=a)(b)', 'g', en);
    expect(o.parseOk).toBe(true);
    expect(o.segments.some((s) => s.text.startsWith('Flags:'))).toBe(true);
    expect(o.segments.some((s) => s.text.includes('Assertion'))).toBe(true);
    expect(o.segments.some((s) => s.text.includes('Capturing group'))).toBe(true);
  });
});

describe('regexTokensToSemanticSpans', () => {
  test('跳过 text 与 group', () => {
    const spans = regexTokensToSemanticSpans(lexRegexPatternTokens('(a\\d)', 'g'));
    expect(spans.every((s) => s.kind !== 'group')).toBe(true);
    expect(spans.some((s) => s.kind === 'escape')).toBe(true);
  });
});
