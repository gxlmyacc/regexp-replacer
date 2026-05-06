import React, { memo, useMemo, useRef } from 'react';
import type { MatchItem } from '../features/tester/matchHighlighter';
import './ListResultPanel.scss';

export type ListResultPanelProps = {
  className?: string;
  matches: MatchItem[];
  maxItems: number;
  onTruncated?: () => void;
  onCtrlA?: () => void;
};

/**
 * 列表项的稳定 React key（优先使用匹配序号与偏移；缺省时退回序号与文本长度）。
 *
 * @param m 匹配项。
 * @param fallbackIndex 缺省字段时的序号。
 * @returns key 字符串。
 */
function listRowReactKey(m: MatchItem, fallbackIndex: number): string {
  const { index, startOffset, endOffset } = m;
  if (
    typeof index === 'number' &&
    typeof startOffset === 'number' &&
    typeof endOffset === 'number'
  ) {
    return `${index}-${startOffset}-${endOffset}`;
  }
  return `row-${fallbackIndex}-${m.matchText.length}`;
}

/**
 * List 页签结果面板：普通滚动列表展示匹配内容（自然行高，支持多行 matchText）。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const ListResultPanel = memo(function ListResultPanel(props: ListResultPanelProps): React.ReactElement {
  const { className, matches, maxItems, onTruncated, onCtrlA } = props;
  const truncatedRef = useRef(false);

  const items = useMemo(() => {
    const limit = Math.max(0, maxItems);
    const next = matches.length > limit ? matches.slice(0, limit) : matches;
    if (matches.length > limit && !truncatedRef.current) {
      truncatedRef.current = true;
      onTruncated?.();
    }
    return next;
  }, [matches, maxItems, onTruncated]);

  return (
    <div
      className={`${className ?? ''} listResultPanel`.trim()}
      tabIndex={0}
      role="list"
      onKeyDown={(e) => {
        const isA = e.key.toLowerCase() === 'a';
        const isSelectAll = isA && (e.ctrlKey || e.metaKey);
        if (!isSelectAll) return;
        e.preventDefault();
        onCtrlA?.();
      }}
    >
      <div className="listResultScroll">
        {items.map((m, i) => (
          <div key={listRowReactKey(m, i)} className="listRowPlain" role="listitem">
            <div className="listRowText">{m.matchText}</div>
          </div>
        ))}
      </div>
    </div>
  );
});
