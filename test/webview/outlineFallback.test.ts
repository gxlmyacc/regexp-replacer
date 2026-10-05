import { expect, test, vi } from 'vitest';
import { buildRegexExplainOutline } from '../../webview/src/utils/regexHighlight/explainOutline';
import * as parser from '../../webview/src/utils/regexLint/parseRegExpPattern';
import * as lexer from '../../webview/src/utils/regexHighlight/lexer';
import { getDict } from '../../webview/src/i18n';

test('解析错误缺失消息与未知 lexer 类型仍可生成降级说明', () => {
  const parse = vi.spyOn(parser, 'parseRegExpPattern').mockReturnValue({ ok: false, error: { toString: () => 'parse failed' } as any });
  const lex = vi.spyOn(lexer, 'lexRegexPatternTokens').mockReturnValue([{ type: 'future-token', value: 'value' }] as any);
  try {
    const outline = buildRegexExplainOutline('x', '', getDict('en')); expect(outline.parseErrorDetail).toBe('parse failed'); expect(outline.segments.at(-1)?.text).toContain('future-token');
    expect(buildRegexExplainOutline('  ', '', getDict('en')).segments.at(-1)?.text).toBe(getDict('en').explainRegexEmptyPattern);
  } finally { parse.mockRestore(); lex.mockRestore(); }
});
