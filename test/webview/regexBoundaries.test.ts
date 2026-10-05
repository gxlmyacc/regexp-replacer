import { expect, test, vi } from 'vitest';
import { collectRegexExpressionDiagnostics } from '../../webview/src/utils/regexExpressionDiagnostics';
import { engineSyntaxRule } from '../../webview/src/utils/regexLint/rules/engineSyntaxRule';
import { parseRegExpPattern } from '../../webview/src/utils/regexLint/parseRegExpPattern';
import { RegExpParser } from '@eslint-community/regexpp';
import { buildRegexExplainOutline } from '../../webview/src/utils/regexHighlight/explainOutline';
import { getDict } from '../../webview/src/i18n';
import { computeMatches, normalizeFlags, buildSearchRegex } from '../../webview/src/features/tester/matchHighlighter';
import { findMatchAtOffset, buildMatchTooltipModel } from '../../webview/src/features/tester/matchTooltip';
import { computeReplacePreview } from '../../webview/src/features/tools/replacePreview';
import { computeReorderedCommands, computeReorderPayloadFromSnapshot } from '../../webview/src/features/app/reorder/reorderCommands';

test('量词的等价简写、前向引用和未知引擎错误详情', () => {
  for (const pattern of ['a{1,1}', 'a{1,}', 'a{1,}?', 'a{0,}', 'a{0,}?', 'a{0,1}', 'a{0,1}?']) expect(collectRegexExpressionDiagnostics(pattern, '', 'en').some(d => d.severity === 'suggestion')).toBe(true);
  expect(collectRegexExpressionDiagnostics('a{2,3}', '', 'en').filter(d => d.severity === 'suggestion')).toEqual([]);
  expect(collectRegexExpressionDiagnostics(String.raw`\1(a)`, '', 'en').some(d => d.severity === 'warning')).toBe(true);
  expect(collectRegexExpressionDiagnostics(String.raw`(?<name>a)\k<name>`, '', 'en').filter(d => d.severity === 'error')).toEqual([]);
  for (const [text, flags] of [['[', ''], ['(', ''], ['*', ''], ['x', 'zz'], ['(?x)', ''], [String.raw`\q`, 'u'], [')', '']]) {
    const ctx: any = { text, flags, language: 'zh-CN' };
    const diagnostics = engineSyntaxRule.collect(ctx, []); expect(diagnostics).toHaveLength(1); expect(diagnostics[0].severity).toBe('error');
  }
  for (const message of ['', 'custom failure']) {
    const mock = vi.spyOn(globalThis, 'RegExp').mockImplementation(() => { throw message; });
    try { expect(engineSyntaxRule.collect({ text: 'x', flags: '', language: 'en' } as any, [])[0].message).toBeTruthy(); } finally { mock.mockRestore(); }
  }
  expect(parseRegExpPattern(undefined as any, '').ok).toBe(true);
  const mock = vi.spyOn(RegExpParser.prototype, 'parsePattern').mockImplementation(() => { throw new Error('internal'); });
  try { expect(() => parseRegExpPattern('x', '')).toThrow('internal'); } finally { mock.mockRestore(); }
  const outline = buildRegexExplainOutline(String.raw`^.[a-z]+\d|(abc`, '', getDict('en')); expect(outline.parseOk).toBe(false); expect(outline.segments.length).toBeGreaterThan(5);
  const ast = buildRegexExplainOutline('a', '', getDict('en')); expect(ast.parseOk).toBe(true); expect(ast.segments[0].text).toBeTruthy();
});

test('匹配边界、可选捕获组以及截断和映射预览', () => {
  const rule: any = { engine: 'regex', find: '(a)?b', replace: '' };
  const matches = computeMatches(rule, 'b ab', { maxMatches: 1 }); expect(matches).toHaveLength(1); expect(matches[0].groups).toEqual(['']);
  expect(computeMatches({ ...rule, find: '' }, 'abc', { maxMatches: 5 })).toEqual([]);
  expect(normalizeFlags('', { forceGlobal: false })).toBe('g'); expect(normalizeFlags('i', { forceGlobal: false })).toBe('i');
  expect(buildSearchRegex({ engine: 'wildcard', find: '*', replace: '', wildcardOptions: { dotAll: true } }).flags).toContain('s');
  const item: any = { index: 0, startOffset: 2, endOffset: 4, matchText: 'ab', groups: null };
  expect(buildMatchTooltipModel(item).groups).toEqual([]);
  for (const pos of [NaN, -1, 0, 5]) expect(findMatchAtOffset([item], pos)).toBeUndefined(); expect(findMatchAtOffset([], 3)).toBeUndefined(); expect(findMatchAtOffset([item], 4)).toBe(item);
  expect(findMatchAtOffset(new Array(1), 0)).toBeUndefined();
  const opts = { maxPreviewChars: 1 };
  expect(computeReplacePreview({ ...rule, find: undefined }, 'abc', '', opts).previewText).toBe('a…');
  expect(computeReplacePreview({ ...rule, find: '' }, 'abc', '', { ...opts, collectHighlightParts: false }).previewParts).toEqual([]);
  expect(computeReplacePreview({ ...rule, replaceMode: 'map' }, 'ab', '', opts).fullText).toBe('ab');
  expect(computeReplacePreview({ ...rule, engine: 'text', find: 'a', replaceMode: 'map' }, 'a', '', opts).fullText).toBe('a');
  const mapped = computeReplacePreview({ ...rule, replaceMode: 'map', map: { mode: 'text', cases: [{ find: null, replace: null }, { find: 'a', replace: 'Z' }] } }, 'b ab', '', { maxPreviewChars: 1 }); expect(mapped.fullText).toBe('b Zb');
  expect(computeReplacePreview({ ...rule, find: 'a' }, 'a', '', { maxPreviewChars: 0 }).previewText).toBe('');
});

test('非法排序输入不会丢失命令或覆盖保存快照', () => {
  const list: any = [{ id: 'a' }, { id: 'b' }];
  for (const ids of [undefined, [], ['a'], ['a', 'a', 'b']]) { expect(computeReorderedCommands(list, ids as any)).toBe(list); expect(computeReorderPayloadFromSnapshot(list, ids as any)).toBeNull(); }
  expect(computeReorderPayloadFromSnapshot(null as any, ['b', 'a'])).toBeNull(); expect(computeReorderPayloadFromSnapshot([], ['b', 'a'])).toBeNull();
});

