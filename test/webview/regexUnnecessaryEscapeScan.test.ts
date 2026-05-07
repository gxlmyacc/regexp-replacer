import { describe, expect, test } from 'vitest';
import { scanUnnecessaryEscapeRanges } from '../../webview/src/utils/regexLint/internal/scanUnnecessaryEscapeRanges';

describe('regexUnnecessaryEscapeScan', () => {
  test('类外 \\a 为冗余转义', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\a`)).toEqual([{ from: 0, to: 2 }]);
  });

  test('类外 \\. 保留（点为元字符）', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\.`)).toEqual([]);
  });

  test('类外 \\( 保留', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\(`)).toEqual([]);
  });

  test('类外 \\\\ 保留', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\\`)).toEqual([]);
  });

  test('类外 \\n 保留', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\n`)).toEqual([]);
  });

  test('类外 \\d 保留', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\d`)).toEqual([]);
  });

  test('类外 \\1 保留（反向引用）', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\12`)).toEqual([]);
  });

  test('类内 [.] 中 \\. 为冗余', () => {
    expect(scanUnnecessaryEscapeRanges('[\\.]')).toEqual([{ from: 1, to: 3 }]);
  });

  test('类内 [\\d] 不误报', () => {
    expect(scanUnnecessaryEscapeRanges('[\\d]')).toEqual([]);
  });

  test('类内 \\] 保留', () => {
    expect(scanUnnecessaryEscapeRanges('[\\]]')).toEqual([]);
  });

  test('类内 \\- 保守不提示', () => {
    expect(scanUnnecessaryEscapeRanges('[\\-]')).toEqual([]);
  });

  test('类外 \\z 等为冗余 identity', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\z`)).toEqual([{ from: 0, to: 2 }]);
  });

  test('类外 \\B 保留', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\B`)).toEqual([]);
  });

  test('类外 \\cA 保留（控制符）', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\cA`)).toEqual([]);
  });

  test('类外 \\x41 保留', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\x41`)).toEqual([]);
  });

  test('类外 \\x4 不完整仍视为必要转义片段', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\x4`)).toEqual([]);
  });

  test('类外 \\u0041 保留', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\u0041`)).toEqual([]);
  });

  test('类外 \\u{61} 保留', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\u{61}`)).toEqual([]);
  });

  test('类外 \\u{61 无闭合仍消费前缀', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\u{61`)).toEqual([]);
  });

  test('类外 \\p{L} 保留', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\p{L}`)).toEqual([]);
  });

  test('类外 \\p{L 无闭合', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\p{L`)).toEqual([]);
  });

  test('类外 \\k<n> 保留', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\k<n>`)).toEqual([]);
  });

  test('类外 \\k<n 无闭合', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\k<n`)).toEqual([]);
  });

  test('类内 \\cA 保留', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`[\cA]`)).toEqual([]);
  });

  test('类内 \\c 缺第三字符视为冗余（未闭合字符类）', () => {
    expect(scanUnnecessaryEscapeRanges('[\\c')).toEqual([{ from: 1, to: 3 }]);
  });

  test('类内 \\x41 保留', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`[\x41]`)).toEqual([]);
  });

  test('类内 \\x4 不完整', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`[\x4]`)).toEqual([]);
  });

  test('类内 \\u0041 保留', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`[\u0041]`)).toEqual([]);
  });

  test('类内 \\u{61} 保留', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`[\u{61}]`)).toEqual([]);
  });

  test('类内 \\u{61 无闭合', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`[\u{61]`)).toEqual([]);
  });

  test('类内 \\p{L} 保留', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`[\p{L}]`)).toEqual([]);
  });

  test('类内 \\p{L 无闭合', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`[\p{L]`)).toEqual([]);
  });

  test('类内 \\k<x> 保留', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`[\k<x>]`)).toEqual([]);
  });

  test('类内 \\k<x 无闭合', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`[\k<x]`)).toEqual([]);
  });

  test('类内 \\[ 冗余', () => {
    expect(scanUnnecessaryEscapeRanges('[\\[]')).toEqual([{ from: 1, to: 3 }]);
  });

  test('类内 \\^ 冗余', () => {
    expect(scanUnnecessaryEscapeRanges('[\\^a]')).toEqual([{ from: 1, to: 3 }]);
  });

  test('类内 \\b 走冗余管线并带 char-class-b 提示（退格非单词边界）', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`[\b]`)).toEqual([{ from: 1, to: 3, hint: 'char-class-b' }]);
  });

  test('类外 \\b 不误报', () => {
    expect(scanUnnecessaryEscapeRanges(String.raw`\b`)).toEqual([]);
  });

  test('字符串末单独 \\ 不标冗余', () => {
    expect(scanUnnecessaryEscapeRanges('\\')).toEqual([]);
  });

  test('scanUnnecessaryEscapeRanges 接受 nullish 按空串处理', () => {
    expect(scanUnnecessaryEscapeRanges(null as unknown as string)).toEqual([]);
  });

  test('字符类首槽 ] 与后续 ] 共存时不误报内部区间', () => {
    expect(scanUnnecessaryEscapeRanges('[]]')).toEqual([]);
  });
});
