import React, { memo, useEffect, useMemo, useRef, useState } from 'react';

export type VirtualListProps<T> = {
  items: T[];
  rowHeight: number;
  overscan?: number;
  className?: string;
  renderRow: (item: T, index: number) => React.ReactNode;
};

/**
 * 通用虚拟列表：仅渲染可视区域附近的行，避免大数据量下 DOM 过多导致卡顿。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const VirtualList = memo(function VirtualList<T>(props: VirtualListProps<T>): React.ReactElement {
  const { items, rowHeight, overscan = 6, className, renderRow } = props;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [viewportH, setViewportH] = useState(240);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewportH(el.clientHeight || 240);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const range = useMemo(() => {
    const h = Math.max(1, rowHeight);
    const start = Math.max(0, Math.floor(scrollTop / h) - overscan);
    const visible = Math.ceil(viewportH / h) + overscan * 2;
    const end = Math.min(items.length, start + visible);
    return { start, end };
  }, [items.length, overscan, rowHeight, scrollTop, viewportH]);

  const totalH = Math.max(0, items.length * Math.max(1, rowHeight));

  return (
    <div
      ref={hostRef}
      className={className}
      onScroll={(e) => setScrollTop((e.currentTarget as HTMLDivElement).scrollTop)}
      style={{ overflow: 'auto', position: 'relative' }}
    >
      <div style={{ height: totalH, position: 'relative' }}>
        {items.slice(range.start, range.end).map((it, i) => {
          const index = range.start + i;
          return (
            <div
              key={index}
              style={{
                position: 'absolute',
                top: index * rowHeight,
                left: 0,
                right: 0,
                height: rowHeight,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {renderRow(it, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
});

