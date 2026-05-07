import { describe, expect, test } from 'vitest';
import { collectCapturingGroupOpenOffsets, scanRegexCaptureDecorHints } from '../../webview/src/utils/regexCaptureGroupScan';
import { hasAnyCapturingGroup } from '../../webview/src/utils/index';

describe('regexCaptureGroupScan', () => {
  test('(a)(?:b)(c)：仅捕获开括号编号 1、2', () => {
    const s = '(a)(?:b)(c)';
    const opens = collectCapturingGroupOpenOffsets(s);
    expect(opens).toEqual([
      { openOffset: 0, index: 1 },
      { openOffset: 8, index: 2 },
    ]);
  });

  test('(?<n>x)：1 个捕获，组名区间 n', () => {
    const s = '(?<n>x)';
    const r = scanRegexCaptureDecorHints(s);
    expect(r.capturingOpens).toEqual([{ openOffset: 0, index: 1 }]);
    expect(r.namedGroupNameRanges).toEqual([{ from: 3, to: 4 }]);
    expect(r.namedGroupHeaderRanges).toEqual([{ from: 0, to: 5 }]);
  });

  test("(?'foo'x)：1 个捕获，组名区间 foo", () => {
    const s = "(?'foo'x)";
    const r = scanRegexCaptureDecorHints(s);
    expect(r.capturingOpens).toEqual([{ openOffset: 0, index: 1 }]);
    expect(r.namedGroupNameRanges).toEqual([{ from: 3, to: 6 }]);
    expect(r.namedGroupHeaderRanges).toEqual([{ from: 0, to: 7 }]);
  });

  test('(?<=x)(y)：lookbehind 不计捕获，仅第二个 ( 为捕获 1', () => {
    const s = '(?<=x)(y)';
    const opens = collectCapturingGroupOpenOffsets(s);
    expect(opens).toEqual([{ openOffset: 6, index: 1 }]);
  });

  test('字符类内 ( 不计捕获', () => {
    const s = '[(?<n>x)]';
    expect(collectCapturingGroupOpenOffsets(s)).toEqual([]);
  });

  test('(?#(nested)comment) 注释内括号不计捕获', () => {
    const s = '(?#(nested)comment)a';
    expect(collectCapturingGroupOpenOffsets(s)).toEqual([]);
  });

  test('hasAnyCapturingGroup：(?<n>x) 为 true（命名捕获）', () => {
    expect(hasAnyCapturingGroup('(?<n>x)')).toBe(true);
  });

  test('hasAnyCapturingGroup：(?:x) 为 false', () => {
    expect(hasAnyCapturingGroup('(?:x)')).toBe(false);
  });

  test('(?:)(?=a)(?!b)：非捕获与前瞻断言不计捕获', () => {
    expect(collectCapturingGroupOpenOffsets('(?:)(?=a)(?!b)')).toEqual([]);
  });

  test('(?<=a)(?<!b)(z)：后顾断言跳过，普通捕获仍编号', () => {
    expect(collectCapturingGroupOpenOffsets('(?<=a)(?<!b)(z)')).toEqual([{ openOffset: 12, index: 1 }]);
  });

  test('(?< 缺少 > 时仍记录捕获开括号（退化扫描）', () => {
    expect(collectCapturingGroupOpenOffsets('(?<)')).toEqual([{ openOffset: 0, index: 1 }]);
  });

  test("(?' 缺少闭合引号时仍记录捕获开括号", () => {
    expect(collectCapturingGroupOpenOffsets("(?'")).toEqual([{ openOffset: 0, index: 1 }]);
  });

  test('(?<>)：空组名不写 namedGroupNameRanges，仍有 header', () => {
    const r = scanRegexCaptureDecorHints('(?<>)');
    expect(r.namedGroupNameRanges).toEqual([]);
    expect(r.namedGroupHeaderRanges).toEqual([{ from: 0, to: 4 }]);
    expect(r.capturingOpens).toEqual([{ openOffset: 0, index: 1 }]);
  });
});
