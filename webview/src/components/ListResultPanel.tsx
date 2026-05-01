import React, { memo, useMemo, useRef } from 'react';
import type { MatchItem } from '../features/tester/matchHighlighter';
import { AutoEllipsis, VirtualList } from './base';
import './ListResultPanel.scss';

export type ListResultPanelProps = {
  className?: string;
  matches: MatchItem[];
  maxItems: number;
  onTruncated?: () => void;
  onCtrlA?: () => void;
};

/**
 * List 页签结果面板：使用虚拟列表展示匹配内容，适配大量结果。
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
      <VirtualList
        className="listVirtualHost"
        items={items}
        rowHeight={22}
        renderRow={(m: any) => (
          <AutoEllipsis className="listRowText" content={m.matchText} block>
            {m.matchText}
          </AutoEllipsis>
        )}
      />
    </div>
  );
});

