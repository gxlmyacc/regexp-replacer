import { expect, test } from 'vitest';
import { collectBracketPairs } from '../../webview/src/utils/regexLint/internal/collectBracketPairs';
import { scanRegexCaptureDecorHints } from '../../webview/src/utils/regexLint/internal/scanRegexCaptureDecorHints';
import { scanUnnecessaryEscapeRanges } from '../../webview/src/utils/regexLint/internal/scanUnnecessaryEscapeRanges';
import { mergeSemanticSpans } from '../../webview/src/utils/regexHighlight/mergeSemanticSpans';
import { charClassShorthandAsciiWarningRule } from '../../webview/src/utils/regexLint/rules/charClassShorthandAsciiWarningRule';
import { dotAllEquivalentSuggestionRule } from '../../webview/src/utils/regexLint/rules/dotAllEquivalentSuggestionRule';
import { parseRegExpPattern } from '../../webview/src/utils/regexLint/parseRegExpPattern';

test('未闭合注释、负向后顾与游离闭括号不产生捕获或括号对', () => {
  expect(scanRegexCaptureDecorHints('(?#unfinished(a)'.slice(0, -1)).capturingOpens).toEqual([]);
  expect(scanRegexCaptureDecorHints('(?<!x)(a)').capturingOpens).toEqual([{ openOffset: 6, index: 1 }]);
  expect(scanRegexCaptureDecorHints(undefined as any).capturingOpens).toEqual([]);
  expect(collectBracketPairs(']a')).toEqual([]);
  expect(collectBracketPairs('[a]')).toEqual([{ openOffset: 0, closeOffset: 2, depth: 1, kind: 'square' }]);
});

test.each([String.raw`[\n\r\t\v\f\0\u0041\uZZZZ]`, String.raw`\0\u0041\uZZZZ`])('有效控制字符和未完成 Unicode 转义不误报冗余: %s', pattern => {
  expect(scanUnnecessaryEscapeRanges(pattern)).toEqual([]);
});

test('同起点跨度按终点排序并保持 AST 优先级', () => {
  expect(mergeSemanticSpans([{ from: 0, to: 3, kind: 'escape' }, { from: 0, to: 1, kind: 'escape' }], [])).toEqual([
    { from: 0, to: 1, kind: 'escape' }, { from: 0, to: 3, kind: 'escape' },
  ]);
  expect(mergeSemanticSpans([{ from: 0, to: 3, kind: 'escape' }], [{ from: 1, to: 2, kind: 'class' }])).toEqual([
    { from: 0, to: 1, kind: 'escape' }, { from: 1, to: 2, kind: 'class' }, { from: 2, to: 3, kind: 'escape' },
  ]);
});

test('混合简写字符类不能被识别为互补全集，Unicode 集合不使用 ASCII 简写建议', () => {
  for (const flags of ['', 'v']) {
    const text = String.raw`[\d\W]`; const parsed = parseRegExpPattern(text, flags);
    expect(parsed.ok).toBe(true);
    const ctx: any = { text, flags, language: 'en', parsedPattern: parsed.ok ? parsed.pattern : undefined };
    expect(dotAllEquivalentSuggestionRule.collect(ctx, [])).toEqual([]);
    const warnings = charClassShorthandAsciiWarningRule.collect(ctx, []);
    expect(warnings.length).toBe(flags === 'v' ? 0 : 1);
  }
});


test('重置已变更 ID 的草稿时使用快照中的现有草稿', async () => {
  const { computeResetToSaved } = await import('../../webview/src/features/app/commands/draftAndSnapshot');
  const { createDraftCommand, createDefaultRule } = await import('../../webview/src/utils');
  const current = createDraftCommand('Untitled command'); const saved = createDraftCommand('Untitled command');
  const result = computeResetToSaved({ snapshot: [saved], currentCommands: [current], prevSelectedId: current.id, prevSelectedRuleIndex: 99, untitledTitle: 'Untitled command', createDraftCommand, createDefaultRule });
  expect(result.nextCommands).toEqual([saved]); expect(result.nextSelectedId).toBe(saved.id); expect(result.nextSelectedRuleIndex).toBe(0);
});
