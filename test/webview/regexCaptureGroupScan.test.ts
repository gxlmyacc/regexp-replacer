import { describe, expect, test } from 'vitest';
import { countCapturingGroups } from '../../webview/src/utils/regexLint/countCapturingGroups';
import { hasAnyCapturingGroup } from '../../webview/src/utils/index';

describe('countCapturingGroups', () => {
  test('(a)(?:b)(c)：2 个捕获组', () => {
    expect(countCapturingGroups('(a)(?:b)(c)', '')).toBe(2);
  });

  test('(?<n>x)：1 个捕获（命名组）', () => {
    expect(countCapturingGroups('(?<n>x)', '')).toBe(1);
  });

  test('(?<foo>x)：命名捕获计 1（与 (?<n>x) 同类）', () => {
    expect(countCapturingGroups('(?<foo>x)', '')).toBe(1);
  });

  test('(?<=x)(y)：lookbehind 不计捕获', () => {
    expect(countCapturingGroups('(?<=x)(y)', '')).toBe(1);
  });

  test('字符类内 ( 不计捕获', () => {
    expect(countCapturingGroups('[(?<n>x)]', '')).toBe(0);
  });

  test('(?#(nested)comment) 注释内括号不计捕获', () => {
    expect(countCapturingGroups('(?#(nested)comment)a', '')).toBe(0);
  });

  test('hasAnyCapturingGroup：(?<n>x) 为 true（命名捕获）', () => {
    expect(hasAnyCapturingGroup('(?<n>x)')).toBe(true);
  });

  test('hasAnyCapturingGroup：(?:x) 为 false', () => {
    expect(hasAnyCapturingGroup('(?:x)')).toBe(false);
  });

  test('(?:)(?=a)(?!b)：非捕获与前瞻断言不计捕获', () => {
    expect(countCapturingGroups('(?:)(?=a)(?!b)', '')).toBe(0);
  });

  test('(?<=a)(?<!b)(z)：后顾断言跳过，普通捕获仍计数', () => {
    expect(countCapturingGroups('(?<=a)(?<!b)(z)', '')).toBe(1);
  });

  test('(?<) 等语法错误：解析失败时计数为 0', () => {
    expect(countCapturingGroups('(?<)', '')).toBe(0);
  });

  test("(?' 语法不完整：解析失败时计数为 0", () => {
    expect(countCapturingGroups("(?'", '')).toBe(0);
  });

  test('(?<>)：非法组名，解析失败时计数为 0', () => {
    expect(countCapturingGroups('(?<>)', '')).toBe(0);
  });
});
