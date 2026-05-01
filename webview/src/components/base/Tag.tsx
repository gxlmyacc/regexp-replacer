import React, { forwardRef, memo } from 'react';
import { Icon } from './Icon';
import './Tag.scss';

export type TagTone = 'default' | 'danger';
export type TagSize = 'sm' | 'md';

export type TagProps = React.HTMLAttributes<HTMLSpanElement> & {
  /**
   * 标签状态：用于在同一基础样式上表达不同语义（例如错误）。
   */
  tone?: TagTone;
  /**
   * 标签尺寸：用于适配不同密度的区域（例如顶部信息栏）。
   */
  size?: TagSize;
  /**
   * 关闭回调：提供后将渲染关闭按钮。
   *
   * @returns 无返回值。
   */
  onClose?: () => void;
  /**
   * 关闭按钮的 aria-label。
   */
  closeAriaLabel?: string;
  /**
   * 关闭按钮额外 className：便于兼容旧样式（例如 hookChipRemove）。
   */
  closeClassName?: string;
};

/**
 * 通用 Tag 组件：用于渲染小型状态标签/徽标/可关闭 chip，并统一结构与交互规范。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const Tag = memo(
  forwardRef<HTMLSpanElement, TagProps>(function Tag(props, ref): React.ReactElement {
    const {
      tone = 'default',
      size = 'md',
      onClose,
      closeAriaLabel = '关闭',
      closeClassName = '',
      className = '',
      children,
      ...rest
    } = props;

    const cls = [`rrTag`, `rrTag--${tone}`, `rrTag--${size}`, className].filter(Boolean).join(' ');

    return (
      <span ref={ref} className={cls} {...rest}>
        <span className="rrTag__content">{children}</span>
        {onClose ? (
          <button
            type="button"
            className={['rrTag__close', closeClassName].filter(Boolean).join(' ')}
            aria-label={closeAriaLabel}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <Icon type="close" />
          </button>
        ) : null}
      </span>
    );
  }),
);

