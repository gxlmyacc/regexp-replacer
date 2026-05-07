import { describe, expect, test } from 'vitest';
import { scanUnnecessaryEscapeRanges } from '../../webview/src/utils/regexUnnecessaryEscapeScan';

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
});
