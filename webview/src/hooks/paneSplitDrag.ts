import type React from 'react';

/**
 * 左右分割条：从 mousedown 起在全局跟踪指针，按水平 delta 调整宽度。
 *
 * @param e 鼠标按下事件。
 * @param ctx 起始宽度、范围与回写。
 * @returns 无返回值。
 */
export function attachVerticalSplitDrag(
  e: React.MouseEvent,
  ctx: {
    startWidth: number;
    min: number;
    max: number;
    onResize: (nextWidth: number) => void;
  },
): void {
  e.preventDefault();
  const startX = e.clientX;
  const { startWidth, min, max, onResize } = ctx;
  const onMove = (ev: MouseEvent): void => {
    const d = ev.clientX - startX;
    const next = Math.max(min, Math.min(max, startWidth + d));
    onResize(next);
  };
  const onUp = (): void => {
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('mouseup', onUp, true);
  };
  window.addEventListener('mousemove', onMove, true);
  window.addEventListener('mouseup', onUp, true);
}

/**
 * 上下分割条：拖拽则调整 tools 区域高度（向上拖为增大 height）。
 *
 * @param e 鼠标按下事件。
 * @param ctx 起始高度、范围与回写。
 * @returns 无返回值。
 */
export function attachHorizontalSplitDrag(
  e: React.MouseEvent,
  ctx: {
    startHeight: number;
    min: number;
    max: number;
    onResize: (nextHeight: number) => void;
  },
): void {
  e.preventDefault();
  const startY = e.clientY;
  const { startHeight, min, max, onResize } = ctx;
  const onMove = (ev: MouseEvent): void => {
    const d = startY - ev.clientY;
    const next = Math.max(min, Math.min(max, startHeight + d));
    onResize(next);
  };
  const onUp = (): void => {
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('mouseup', onUp, true);
  };
  window.addEventListener('mousemove', onMove, true);
  window.addEventListener('mouseup', onUp, true);
}
