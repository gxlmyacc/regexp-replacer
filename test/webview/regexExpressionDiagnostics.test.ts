import { describe, expect, test } from 'vitest';
import {
  collectRegexExpressionDiagnostics,
  pickDiagnosticAtPosition,
} from '../../webview/src/utils/regexExpressionDiagnostics';

describe('regexExpressionDiagnostics', () => {
  test('语法错误 nothing to repeat 映射中文详情', () => {
    const list = collectRegexExpressionDiagnostics('*', 'zh-CN');
    expect(list.some((d) => d.severity === 'error' && d.message.includes('量词前缺少'))).toBe(true);
  });

  test('语法错误英文前缀', () => {
    const list = collectRegexExpressionDiagnostics('*', 'en');
    expect(list.some((d) => d.message.includes('Nothing to repeat'))).toBe(true);
  });

  test('语法错误整段与冗余转义相交时丢弃警告', () => {
    const list = collectRegexExpressionDiagnostics(String.raw`*\a`, 'en');
    expect(list.every((d) => d.severity === 'error')).toBe(true);
    expect(list.some((d) => d.severity === 'warning')).toBe(false);
  });

  test('pickDiagnosticAtPosition：错误优先于警告', () => {
    const text = String.raw`(\a`;
    const list = collectRegexExpressionDiagnostics(text, 'en');
    const pos = 1;
    const hit = pickDiagnosticAtPosition(list, pos);
    expect(hit?.severity).toBe('error');
  });
});
