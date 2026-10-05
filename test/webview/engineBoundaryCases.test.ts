import { expect, test } from 'vitest';
import { applyRule, expandReplacementTemplate } from '../../src/replace/engines';
import { runHookChainOnText } from '../../src/replace/textChain';
import { computeReplacePreview } from '../../webview/src/features/tools/replacePreview';
import { lexRegexPatternTokens } from '../../webview/src/utils/regexHighlight/lexer';

test('导入缺省字段、可选与命名组映射及重叠组先后替换', () => {
  expect(applyRule('abc', { engine: 'text' } as any).text).toBe('abc');
  expect(applyRule('b ab', { engine: 'regex', find: '(a)?b', replace: '$1' } as any).text).toBe(' a');
  const map = { mode: 'text', cases: [{ find: 'aa', replace: 'X' }, { find: 'a', replace: 'Y' }] } as const;
  const rule: any = { engine: 'regex', find: '(?<outer>a(a))', replaceMode: 'map', map };
  expect(applyRule('aa', rule).text).toBe('X'); expect(computeReplacePreview(rule, 'aa', '', { maxPreviewChars: 100 }).fullText).toBe('X');
  const optional: any = { engine: 'regex', find: '(a)?b', replaceMode: 'map', map: { mode: 'text', cases: [{ find: 'a', replace: 'A' }] } };
  expect(applyRule('b ab', optional).text).toBe('b Ab');
  expect(expandReplacementTemplate('$12:$1', { match: 'x', offset: 0, input: 'x', groups: new Array(12) })).toBe(':');
});

test('hook 不存在、非数组或无效 ID 保持文本；缺省规则字段兼容', () => {
  const options = { ignoreUnknownHookId: false, maxDepth: 3 };
  expect(runHookChainOnText('a', null as any, [], options)).toBe('a');
  expect(runHookChainOnText('a', ['', 2, 'missing'] as any, [], options)).toBe('a');
  expect(runHookChainOnText('a', ['cmd'], [{ id: 'cmd', title: 'C', rules: [{ engine: 'text' }] }] as any, options)).toBe('a');
});

test('正则 lexer 保留不完整转义且兼容扩展转义内部括号', () => {
  for (const pattern of [undefined, String.raw`\u{123`, String.raw`\pX\P{a{b}\}c}`, String.raw`\q{a\}b}`, String.raw`\kX\k'name\'x'\k<unfinished`, String.raw`\123x` + '\\', '[^]]']) {
    const tokens = lexRegexPatternTokens(pattern as any, 'v'); expect(tokens.map(t => t.value).join('')).toBe(pattern || '');
  }
});

