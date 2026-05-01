import React, { memo, useEffect, useRef, useState } from 'react';
import { Popover } from './Popover';
import './Tooltip.scss';

export type TooltipProps = {
  content: string;
  children: React.ReactElement;
  hostClassName?: string;
  /**
   * 显示延时（毫秒）：用于避免鼠标快速划过时 tooltip 闪烁。
   *
   * @default 120
   */
  showDelayMs?: number;
  /**
   * Tooltip host 的元素类型（仅在未开启 useChildAsHost 时生效）。
   *
   * @default 'span'
   */
  hostAs?: keyof JSX.IntrinsicElements;
  /**
   * 是否把 children 直接作为 Popper reference/host（不再额外包一层 span）。
   * 适用于 children 是绝对定位元素等场景，避免 wrapper 影响 reference 的计算。
   *
   * @default false
   */
  useChildAsHost?: boolean;
  block?: boolean;
};

/**
 * 轻量 Tooltip：用于替代原生 title，提供更快显示与主题一致的样式。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const Tooltip = memo(function Tooltip(props: TooltipProps): React.ReactElement {
  const { content, children, hostClassName, showDelayMs = 120, hostAs = 'span', useChildAsHost = false, block = false } = props;
  const [visible, setVisible] = useState(false);
  const hostRef = useRef<HTMLElement | null>(null);
  const showTimerRef = useRef<number | undefined>(undefined);

  /**
   * 将 DOM 节点同步写入 Tooltip 自身的 hostRef，并尽可能保留/转发 child 原有的 ref。
   *
   * @param child 作为 host 的子元素。
   * @param node 当前渲染得到的 DOM 节点。
   * @returns 无返回值。
   */
  function mergeChildRef(child: React.ReactElement, node: HTMLElement | null): void {
    hostRef.current = node;
    const rawRef = (child as any).ref as any;
    if (!rawRef) return;
    if (typeof rawRef === 'function') {
      rawRef(node);
      return;
    }
    try {
      rawRef.current = node;
    } catch {
      // 忽略不可写 ref（例如某些只读 ref 实现）
    }
  }

  /**
   * 清理显示定时器，避免重复触发或组件卸载后更新状态。
   *
   * @returns 无返回值。
   */
  function clearShowTimer(): void {
    if (!showTimerRef.current) return;
    window.clearTimeout(showTimerRef.current);
    showTimerRef.current = undefined;
  }

  /**
   * 触发“延时显示”逻辑。
   *
   * @returns 无返回值。
   */
  function requestShow(): void {
    clearShowTimer();
    const delay = Math.max(0, showDelayMs);
    if (!delay) {
      setVisible(true);
      return;
    }
    showTimerRef.current = window.setTimeout(() => {
      showTimerRef.current = undefined;
      setVisible(true);
    }, delay);
  }

  /**
   * 立即隐藏 tooltip，并取消任何待触发的显示定时器。
   *
   * @returns 无返回值。
   */
  function requestHide(): void {
    clearShowTimer();
    setVisible(false);
  }

  useEffect(() => () => clearShowTimer(), []);

  /**
   * 给 host/child 注入 hover/focus 事件与 reference ref。
   *
   * @param child 需要增强的 Tooltip 宿主元素。
   * @returns 增强后的 React 元素。
   */
  function enhanceChildHost(child: React.ReactElement): React.ReactElement {
    const childProps = child.props as any;
    const mergedClassName = ['rrTooltipHost', block ? 'rrTooltipHost--block' : '', hostClassName ?? '', childProps.className ?? '']
      .filter(Boolean)
      .join(' ');

    return React.cloneElement(child, {
      ref: (node: HTMLElement | null) => {
        mergeChildRef(child, node);
      },
      className: mergedClassName,
      onMouseEnter: (ev: any) => {
        childProps.onMouseEnter?.(ev);
        requestShow();
      },
      onMouseLeave: (ev: any) => {
        childProps.onMouseLeave?.(ev);
        requestHide();
      },
      onFocus: (ev: any) => {
        childProps.onFocus?.(ev);
        requestShow();
      },
      onBlur: (ev: any) => {
        childProps.onBlur?.(ev);
        requestHide();
      },
    });
  }

  const HostTag = hostAs as any;

  return (
    useChildAsHost ? (
      <>
        {enhanceChildHost(children)}
        <Popover
          open={visible && Boolean(content)}
          referenceEl={hostRef.current}
          placement="top"
          offset={10}
          autoFlip={true}
          className="rrTooltipBubble"
          arrow={true}
          arrowClassName="rrTooltipArrow"
        >
          <span role="tooltip">{content}</span>
        </Popover>
      </>
    ) : (
      <HostTag
        ref={hostRef}
        className={`rrTooltipHost ${block ? 'rrTooltipHost--block' : ''} ${hostClassName ?? ''}`.trim()}
        onMouseEnter={() => requestShow()}
        onMouseLeave={() => requestHide()}
        onFocus={() => requestShow()}
        onBlur={() => requestHide()}
      >
        {children}
        <Popover
          open={visible && Boolean(content)}
          referenceEl={hostRef.current}
          placement="top"
          offset={10}
          autoFlip={true}
          className="rrTooltipBubble"
          arrow={true}
          arrowClassName="rrTooltipArrow"
        >
          <span role="tooltip">{content}</span>
        </Popover>
      </HostTag>
    )
  );
});

