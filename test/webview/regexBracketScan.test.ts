import { describe, expect, test } from 'vitest';
import {
  collectBracketDiagnostics,
  collectBracketPairs,
  hasUnescapedCloseBracketAfter,
} from '../../webview/src/utils/regexBracketScan';

describe('hasUnescapedCloseBracketAfter', () => {
  test('空串起始之后无 ]', () => {
    expect(hasUnescapedCloseBracketAfter('', 0)).toBe(false);
  });

  test('其后存在未转义 ]', () => {
    expect(hasUnescapedCloseBracketAfter('[]]', 2)).toBe(true);
    expect(hasUnescapedCloseBracketAfter('ax]', 1)).toBe(true);
  });

  test('转义后的 ] 不计入闭合括号', () => {
    expect(hasUnescapedCloseBracketAfter('\\]', 0)).toBe(false);
    expect(hasUnescapedCloseBracketAfter('\\]]', 0)).toBe(true);
  });

  test('[] 第一个 ] 之后无第二个 ]', () => {
    expect(hasUnescapedCloseBracketAfter('[]', 2)).toBe(false);
  });
});

describe('collectBracketDiagnostics', () => {
  test('[] 与 [^] 不应报括号未匹配（空字符类合法闭合）', () => {
    expect(collectBracketDiagnostics('[]')).toEqual([]);
    expect(collectBracketDiagnostics('[^]')).toEqual([]);
  });

  test('[]]、[^]]：首槽字面量 ]，由后续 ] 闭合字符类', () => {
    expect(collectBracketDiagnostics('[]]')).toEqual([]);
    expect(collectBracketDiagnostics('[^]]')).toEqual([]);
  });

  test('未闭合 [ 报未匹配左括号', () => {
    expect(collectBracketDiagnostics('[')).toMatchObject([
      { from: 0, to: 1, message: '未匹配的左括号 [' },
    ]);
  });

  test('多余右括号', () => {
    expect(collectBracketDiagnostics(')')).toMatchObject([
      { from: 0, to: 1, message: '未匹配的右括号 )' },
    ]);
    expect(collectBracketDiagnostics('a)')).toMatchObject([
      { from: 1, to: 2, message: '未匹配的右括号 )' },
    ]);
  });

  test('圆括号与方括号交叉不匹配', () => {
    expect(collectBracketDiagnostics('(')).toMatchObject([
      { from: 0, to: 1, message: '未匹配的左括号 (' },
    ]);
    expect(collectBracketDiagnostics('(]')).toEqual([
      expect.objectContaining({ message: expect.stringContaining('括号不匹配') }),
    ]);
  });

  test('字符类内的圆括号不参与栈匹配', () => {
    expect(collectBracketDiagnostics('[()]')).toEqual([]);
  });

  test('[) 仅余未闭合字符类（) 在类内视为字面量）', () => {
    expect(collectBracketDiagnostics('[)')).toMatchObject([
      { from: 0, to: 1, message: '未匹配的左括号 [' },
    ]);
  });

  test('花括号配对', () => {
    expect(collectBracketDiagnostics('{1,2}')).toEqual([]);
    expect(collectBracketDiagnostics('{')).toMatchObject([
      { from: 0, to: 1, message: '未匹配的左括号 {' },
    ]);
  });
});

describe('collectBracketPairs', () => {
  test('[]、[ ^ ] 各形成一对 square', () => {
    expect(collectBracketPairs('[]')).toEqual([
      { openOffset: 0, closeOffset: 1, depth: 1, kind: 'square' },
    ]);
    expect(collectBracketPairs('[^]')).toEqual([
      { openOffset: 0, closeOffset: 2, depth: 1, kind: 'square' },
    ]);
  });

  test('[]] 闭合于最后一个 ]', () => {
    expect(collectBracketPairs('[]]')).toEqual([
      { openOffset: 0, closeOffset: 2, depth: 1, kind: 'square' },
    ]);
  });

  test('嵌套圆括号深度', () => {
    expect(collectBracketPairs('(a(b)c)')).toEqual([
      { openOffset: 2, closeOffset: 4, depth: 2, kind: 'round' },
      { openOffset: 0, closeOffset: 6, depth: 1, kind: 'round' },
    ]);
  });
});
