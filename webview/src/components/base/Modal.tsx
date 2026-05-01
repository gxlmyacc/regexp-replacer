import React, { memo, useCallback, useEffect } from 'react';
import './Modal.scss';
import { Button } from './Button';
import { Icon } from './Icon';

export type ModalProps = {
  /** 是否打开（对齐 antd Modal open）。 */
  open: boolean;
  /** 标题（对齐 antd Modal title）。 */
  title?: React.ReactNode;
  /** 点击遮罩或按下 Escape 关闭（对齐 antd Modal onCancel）。 */
  onCancel: () => void;
  /** 宽度（对齐 antd Modal width）。 */
  width?: number | string;
  /** 底部区域（对齐 antd Modal footer；传 null 表示不显示）。 */
  footer?: React.ReactNode | null;
  children: React.ReactNode;
};

/**
 * 基础弹窗组件：open/onCancel/title/footer/width 命名参考 Ant Design。
 *
 * @param props 组件属性。
 * @returns React 元素或 null。
 */
export const Modal = memo(function Modal(props: ModalProps): React.ReactElement | null {
  const { open, title, onCancel, width, footer, children } = props;

  const onOverlayDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onCancel();
    },
    [onCancel],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div className="rrModal__overlay" onMouseDown={onOverlayDown}>
      <div className="rrModal__card" role="dialog" aria-modal="true" style={width ? { width } : undefined}>
        {title !== undefined ? (
          <div className="rrModal__header">
            <div className="rrModal__title">{title}</div>
            <Button preset="topIcon" aria-label="关闭" onClick={onCancel} className="rrModal__close">
              <Icon type="close" />
            </Button>
          </div>
        ) : (
          <div className="rrModal__header rrModal__header--noTitle">
            <Button preset="topIcon" aria-label="关闭" onClick={onCancel} className="rrModal__close">
              <Icon type="close" />
            </Button>
          </div>
        )}
        <div className="rrModal__body">{children}</div>
        {footer === null ? null : footer !== undefined ? <div className="rrModal__footer">{footer}</div> : null}
      </div>
    </div>
  );
});

