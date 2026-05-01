import React, { memo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createPopper, type Instance, type Placement, type PositioningStrategy } from '@popperjs/core';
import './Popover.scss';

export type PopoverProps = {
  open: boolean;
  referenceEl: HTMLElement | null;
  placement?: Placement;
  offset?: number;
  autoFlip?: boolean;
  strategy?: PositioningStrategy;
  className?: string;
  style?: React.CSSProperties;
  arrow?: boolean;
  arrowClassName?: string;
  children: React.ReactNode;
};

/**
 * 通用 Popover 容器：负责 Portal 渲染、Popper 定位与可选箭头。
 *
 * @param props 组件属性。
 * @returns React 元素或 null。
 */
export const Popover = memo(function Popover(props: PopoverProps): React.ReactElement | null {
  const {
    open,
    referenceEl,
    placement = 'bottom-start',
    offset = 8,
    autoFlip = true,
    strategy = 'fixed',
    className,
    style,
    arrow = false,
    arrowClassName,
    children,
  } = props;

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const arrowRef = useRef<HTMLSpanElement | null>(null);
  const popperRef = useRef<Instance | null>(null);

  useEffect(() => {
    const popoverEl = popoverRef.current;
    if (!open || !referenceEl || !popoverEl) return;
    popperRef.current?.destroy();
    popperRef.current = createPopper(referenceEl, popoverEl, {
      placement,
      strategy,
      modifiers: [
        { name: 'offset', options: { offset: [0, offset] } },
        autoFlip ? { name: 'flip', options: { fallbackPlacements: ['bottom-start', 'bottom-end', 'top-start', 'top-end'] } } : { name: 'flip', enabled: false },
        { name: 'preventOverflow', options: { padding: 8, altAxis: true } },
        arrow
          ? { name: 'arrow', options: { element: arrowRef.current, padding: 8 } }
          : { name: 'arrow', enabled: false },
      ],
    });

    const rafId = window.requestAnimationFrame(() => popperRef.current?.update());
    return () => {
      window.cancelAnimationFrame(rafId);
      popperRef.current?.destroy();
      popperRef.current = null;
    };
  }, [open, referenceEl, placement, offset, autoFlip, strategy, arrow]);

  if (!open) return null;

  return createPortal(
    <div ref={popoverRef} className={className} style={style}>
      {arrow ? <span ref={arrowRef} className={`rrPopoverArrow ${arrowClassName ?? ''}`.trim()} data-popper-arrow="" /> : null}
      {children}
    </div>,
    document.body,
  );
});

