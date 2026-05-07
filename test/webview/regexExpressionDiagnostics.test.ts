import { describe, expect, test } from 'vitest';
import {
  collectRegexExpressionDiagnostics,
  pickDiagnosticAtPosition,
} from '../../webview/src/utils/regexExpressionDiagnostics';

describe('regexExpressionDiagnostics', () => {
  test('语法错误 nothing to repeat 映射中文详情', () => {
    const list = collectRegexExpressionDiagnostics('*', '', 'zh-CN');
    expect(list.some((d) => d.severity === 'error' && d.message.includes('量词前缺少'))).toBe(true);
  });

  test('语法错误在 regexpp 带 index 时缩小为高亮区间（单字符 pattern）', () => {
    const list = collectRegexExpressionDiagnostics('*', '', 'zh-CN');
    const err = list.find((d) => d.severity === 'error');
    expect(err).toBeDefined();
    expect(err!.from).toBe(0);
    expect(err!.to).toBe(1);
  });

  test('语法错误英文前缀', () => {
    const list = collectRegexExpressionDiagnostics('*', '', 'en');
    expect(list.some((d) => d.message.includes('Nothing to repeat'))).toBe(true);
  });

  test('字符类内 \\b 使用冗余转义规则专项文案（中文）', () => {
    const list = collectRegexExpressionDiagnostics(String.raw`[\b]`, '', 'zh-CN');
    const w = list.find((d) => d.severity === 'warning');
    expect(w).toBeDefined();
    expect(w!.message).toContain('退格');
    expect(w!.message).toContain('单词边界');
  });

  test('语法错误整段与冗余转义相交时丢弃警告', () => {
    const list = collectRegexExpressionDiagnostics(String.raw`*\a`, '', 'en');
    expect(list.every((d) => d.severity === 'error')).toBe(true);
    expect(list.some((d) => d.severity === 'warning')).toBe(false);
  });

  test('pickDiagnosticAtPosition：错误优先于警告', () => {
    const text = String.raw`(\a`;
    const list = collectRegexExpressionDiagnostics(text, '', 'en');
    const pos = 1;
    const hit = pickDiagnosticAtPosition(list, pos);
    expect(hit?.severity).toBe('error');
  });

  test('pickDiagnosticAtPosition：警告优先于建议', () => {
    const list = [
      { from: 0, to: 5, message: 'sug', severity: 'suggestion' as const },
      { from: 0, to: 5, message: 'warn', severity: 'warning' as const },
    ];
    expect(pickDiagnosticAtPosition(list, 2)?.severity).toBe('warning');
  });

  test('花括号量词 a{1} 给出中文建议', () => {
    const list = collectRegexExpressionDiagnostics('a{1}', '', 'zh-CN');
    const s = list.find((d) => d.severity === 'suggestion');
    expect(s).toBeDefined();
    expect(s!.message).toContain('{1}');
  });

  test('花括号量词 a{1,} 建议使用 +（英文）', () => {
    const list = collectRegexExpressionDiagnostics('a{1,}', '', 'en');
    const s = list.find((d) => d.severity === 'suggestion');
    expect(s).toBeDefined();
    expect(s!.message).toMatch(/\+/);
  });

  test('花括号量词 a{3,3} 建议简写为 {3}', () => {
    const list = collectRegexExpressionDiagnostics('a{3,3}', '', 'en');
    const s = list.find((d) => d.severity === 'suggestion');
    expect(s).toBeDefined();
    expect(s!.message).toContain('{3}');
    expect(s!.message).toContain('{3,3}');
  });

  test('字符类 [\\d] 且无 u/v 时给出 ASCII 简写警告', () => {
    const list = collectRegexExpressionDiagnostics('[\\d]', '', 'zh-CN');
    const w = list.find((d) => d.severity === 'warning');
    expect(w).toBeDefined();
    expect(w!.message).toContain('u');
  });

  test('字符类 [\\d] 在 u 标志下不产生针对简写的警告', () => {
    const list = collectRegexExpressionDiagnostics('[\\d]', 'u', 'zh-CN');
    expect(list.filter((d) => d.severity === 'warning')).toHaveLength(0);
  });

  test('[\\s\\S] 无 s 时给出 dotAll 建议', () => {
    const list = collectRegexExpressionDiagnostics('[\\s\\S]', '', 'en');
    const s = list.find((d) => d.severity === 'suggestion');
    expect(s).toBeDefined();
    expect(s!.message).toMatch(/dotAll|`s`/i);
  });

  test('[\\s\\S] 已有 s 时建议改用 .', () => {
    const list = collectRegexExpressionDiagnostics('[\\s\\S]', 's', 'en');
    const s = list.find((d) => d.severity === 'suggestion');
    expect(s).toBeDefined();
    expect(s!.message).toMatch(/\./);
  });

  test('孤儿数字反向引用 \\1（无捕获组）中文警告', () => {
    const list = collectRegexExpressionDiagnostics(String.raw`\1`, '', 'zh-CN');
    const w = list.find((d) => d.severity === 'warning');
    expect(w).toBeDefined();
    expect(w!.message).toContain('捕获组');
    expect(w!.from).toBe(0);
  });

  test('孤儿数字反向引用 \\1 英文警告', () => {
    const list = collectRegexExpressionDiagnostics(String.raw`\1`, '', 'en');
    expect(list.some((d) => d.severity === 'warning' && d.message.includes('capturing group'))).toBe(true);
  });

  test('(a)\\1 不产生孤儿反向引用警告', () => {
    const list = collectRegexExpressionDiagnostics(String.raw`(a)\1`, '', 'en');
    expect(list.some((d) => d.message.includes('capturing group'))).toBe(false);
  });

  test('(\\1) 开括号在先不产生孤儿反向引用警告', () => {
    const list = collectRegexExpressionDiagnostics(String.raw`(\1)`, '', 'en');
    expect(list.some((d) => d.severity === 'warning' && d.message.includes('capturing group'))).toBe(false);
  });

  test('[\\1] 字符类内不产生孤儿反向引用警告', () => {
    const list = collectRegexExpressionDiagnostics(String.raw`[\1]`, '', 'en');
    expect(list.some((d) => d.severity === 'warning' && d.message.includes('capturing group'))).toBe(false);
  });

  test('引擎校验使用 flags：`u` 下单独的 \\1 为语法错误', () => {
    const list = collectRegexExpressionDiagnostics(String.raw`\1`, 'u', 'en');
    expect(list.some((d) => d.severity === 'error')).toBe(true);
    expect(list.some((d) => d.severity === 'warning' && d.message.includes('capturing group'))).toBe(false);
  });
});
