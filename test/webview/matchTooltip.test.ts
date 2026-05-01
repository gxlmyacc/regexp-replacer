import { describe, expect, test } from 'vitest';
import type { MatchItem } from '../../webview/src/features/tester/matchHighlighter';
import { buildMatchTooltipModel, findMatchAtOffset } from '../../webview/src/features/tester/matchTooltip';

describe('matchTooltip', () => {
  test('findMatchAtOffset：能找到 pos 所在的匹配项', () => {
    const matches: MatchItem[] = [
      { index: 0, startOffset: 0, endOffset: 3, matchText: 'abc', groups: [] },
      { index: 1, startOffset: 10, endOffset: 12, matchText: 'xy', groups: ['x'] },
    ];
    expect(findMatchAtOffset(matches, 1)?.index).toBe(0);
    expect(findMatchAtOffset(matches, 10)?.index).toBe(1);
    expect(findMatchAtOffset(matches, 12)?.index).toBe(1);
    expect(findMatchAtOffset(matches, 9)).toBeUndefined();
  });

  test('buildMatchTooltipModel：输出包含 match/range/groups', () => {
    const m: MatchItem = { index: 2, startOffset: 5, endOffset: 8, matchText: 'foo', groups: ['1', '2'] };
    const model = buildMatchTooltipModel(m);
    expect(model).toEqual({ matchText: 'foo', startOffset: 5, endOffset: 8, groups: ['1', '2'] });
  });
});

