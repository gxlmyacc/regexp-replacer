import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Tooltip } from './Tooltip';
import './AutoEllipsis.scss';

export type AutoEllipsisProps = {
  content: string;
  className?: string;
  block?: boolean;
  children: React.ReactNode;
};

/**
 * 自动省略提示组件：仅当文本发生省略时显示 Tooltip。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const AutoEllipsis = memo(function AutoEllipsis(props: AutoEllipsisProps): React.ReactElement {
  const { content, className, block = false, children } = props;
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [overflowed, setOverflowed] = useState(false);

  /**
   * 计算当前文本是否发生省略，并同步到状态。
   *
   * @returns 无返回值。
   */
  const updateOverflowState = useCallback((): void => {
    const el = textRef.current;
    if (!el) return;
    const next = el.scrollWidth > el.clientWidth;
    setOverflowed(next);
  }, []);

  useEffect(() => {
    updateOverflowState();
    const el = textRef.current;
    if (!el) return;
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateOverflowState());
      observer.observe(el);
      return () => observer.disconnect();
    }
    const onResize = () => updateOverflowState();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [content, updateOverflowState]);

  const textNode = (
    <span
      ref={textRef}
      className={`rrAutoEllipsis ${block ? 'rrAutoEllipsis--block' : ''} ${className ?? ''}`.trim()}
      onMouseEnter={updateOverflowState}
    >
      {children}
    </span>
  );

  return (
    <Tooltip content={overflowed ? content : ''} block={block} useChildAsHost={true}>
      {textNode}
    </Tooltip>
  );
});

