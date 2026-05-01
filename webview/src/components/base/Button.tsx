import React, { forwardRef, memo } from 'react';
import './Button.scss';

export type ButtonType = 'primary' | 'default';
export type ButtonVariant = 'default' | 'icon';
export type ButtonSize = 'xs' | 'sm' | 'md';
export type ButtonPreset = 'default' | 'tab' | 'topIcon' | 'chip';

export type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  /**
   * 样式预设：
   * - default：通用按钮（.btn/.btnSecondary）
   * - tab：页签按钮（.tabBtn/.tabBtnActive）
   * - topIcon：顶部工具栏图标按钮（.topIconBtn/.topIconBtnPrimary）
   * - chip：轻量可切换按钮（.rrChipBtn/.rrChipBtn--on）
   */
  preset?: ButtonPreset;
  /**
   * 按钮类型（对齐 antd Button type）。
   *
   * - preset=default：primary 为蓝底按钮；default 为次要按钮
   * - preset=topIcon：primary 对应 .topIconBtnPrimary
   */
  type?: ButtonType;
  /**
   * 按钮形态（仅 preset=default 使用）：
   * - default：常规按钮
   * - icon：方形图标按钮
   */
  variant?: ButtonVariant;
  /**
   * 图标按钮尺寸（仅 preset=default 且 variant=icon 使用）。
   */
  size?: ButtonSize;
  /**
   * 原生 button type（对齐 antd Button htmlType）。
   */
  htmlType?: 'button' | 'submit' | 'reset';
  /**
   * 是否处于“选中/激活”状态（preset=tab / preset=chip 时使用）。
   */
  active?: boolean;
};

/**
 * 通用按钮组件：统一承载普通按钮、页签按钮、顶部图标按钮三类常见按钮形态。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const Button = memo(
  forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref): React.ReactElement {
    const {
      preset = 'default',
      type = 'default',
      variant = 'default',
      size = 'md',
      active = false,
      htmlType = 'button',
      className = '',
      ...rest
    } = props;

    if (preset === 'tab') {
      const cls = `tabBtn ${active ? 'tabBtnActive' : ''}`.trim();
      return <button ref={ref} type={htmlType} className={`${cls} ${className}`.trim()} {...rest} />;
    }

    if (preset === 'topIcon') {
      const cls = type === 'primary' ? 'topIconBtn topIconBtnPrimary' : 'topIconBtn';
      return <button ref={ref} type={htmlType} className={`${cls} ${className}`.trim()} {...rest} />;
    }

    if (preset === 'chip') {
      const cls = `rrChipBtn ${active ? 'rrChipBtn--on' : ''}`.trim();
      return <button ref={ref} type={htmlType} className={`${cls} ${className}`.trim()} {...rest} />;
    }

    const typeClass = type === 'primary' ? 'btn' : 'btn btnSecondary';
    const variantClass = variant === 'icon' ? `btnIcon btnIcon--${size}` : '';
    const cls = `${typeClass} ${variantClass}`.trim();
    return <button ref={ref} type={htmlType} className={`${cls} ${className}`.trim()} {...rest} />;
  }),
);

