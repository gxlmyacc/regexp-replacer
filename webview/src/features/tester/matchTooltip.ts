import type { MatchItem } from './matchHighlighter';

export type MatchTooltipModel = {
  matchText: string;
  startOffset: number;
  endOffset: number;
  groups: string[];
};

/**
 * 在匹配列表中查找“光标位置所在的匹配项”。
 *
 * @param matches 匹配项列表（按 startOffset 升序）。
 * @param pos 文本偏移位置（CodeMirror 的 doc offset）。
 * @returns 命中的匹配项；未命中则返回 undefined。
 */
export function findMatchAtOffset(matches: MatchItem[], pos: number): MatchItem | undefined {
  if (!Number.isFinite(pos)) return undefined;
  if (!matches.length) return undefined;

  // matches 按 startOffset 升序，使用二分找到最后一个 startOffset <= pos 的项
  let lo = 0;
  let hi = matches.length - 1;
  let cand = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const it = matches[mid];
    if (!it) break;
    if (it.startOffset <= pos) {
      cand = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (cand < 0) return undefined;

  // 向前回溯处理“空匹配 / 同起点”极端情况
  for (let i = cand; i >= 0; i -= 1) {
    const it = matches[i];
    if (!it) continue;
    if (it.startOffset > pos) continue;
    if (it.endOffset < pos) break;
    if (it.startOffset <= pos && pos <= it.endOffset) return it;
  }
  return undefined;
}

/**
 * 将匹配项转换为 tooltip 所需的数据模型。
 *
 * @param match 匹配项。
 * @returns tooltip 数据模型。
 */
export function buildMatchTooltipModel(match: MatchItem): MatchTooltipModel {
  return {
    matchText: match.matchText,
    startOffset: match.startOffset,
    endOffset: match.endOffset,
    groups: Array.isArray(match.groups) ? match.groups : [],
  };
}

