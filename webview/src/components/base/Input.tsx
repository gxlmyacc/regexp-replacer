import React, { forwardRef, memo } from 'react';
import './Input.scss';

export type InputMode = 'singleline' | 'multiline';
export type InputTone = 'default' | 'mono';
export type InputVariant = 'search' | 'mono' | 'ruleTitle' | 'line';

type InputBaseProps = {
  variant?: InputVariant;
  mode?: InputMode;
  tone?: InputTone;
  control?: 'input' | 'textarea';
  htmlType?: 'text' | 'password' | 'email' | 'search' | 'url' | 'tel';
  status?: 'error' | 'warning';
  overlay?: React.ReactNode;
  className?: string;
  controlClassName?: string;
};
export type InputProps = InputBaseProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix' | 'suffix' | 'type' | 'onChange' | 'onInput'> &
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'prefix' | 'suffix' | 'onChange' | 'onInput'> & {
    onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onInput?: (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  };

/**
 * 基于 variant 计算 tone 与 mode，确保旧场景迁移时视觉保持一致。
 *
 * @param variant 输入变体。
 * @returns 对应的 tone 和 mode。
 */
function deriveStyleFromVariant(variant: InputVariant): { tone: InputTone; mode: InputMode } {
  if (variant === 'mono') return { tone: 'mono', mode: 'singleline' };
  if (variant === 'ruleTitle') return { tone: 'mono', mode: 'singleline' };
  return { tone: 'default', mode: 'singleline' };
}

/**
 * 输入控件统一组件：支持 input/textarea，并提供 overlay 高亮层能力。
 *
 * @param props 组件属性。
 * @param ref 原生输入元素引用。
 * @returns React 元素。
 */
const InputImpl = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(function Input(
  props,
  ref,
): React.ReactElement {
  const {
    variant = 'line',
    mode: modeProp,
    tone: toneProp,
    control = 'input',
    htmlType = 'text',
    status,
    disabled,
    overlay,
    className,
    controlClassName,
    ...rest
  } = props;
  const derived = deriveStyleFromVariant(variant);
  const tone = toneProp ?? derived.tone;
  const mode = modeProp ?? (control === 'textarea' ? 'multiline' : derived.mode);
  const hasOverlay = Boolean(overlay);
  const rootCls = [
    'rrInput',
    `rrInput--${mode}`,
    `rrInput--${tone}`,
    `rrInput--variant-${variant}`,
    status ? `rrInput--status-${status}` : '',
    disabled ? 'rrInput--disabled' : '',
    hasOverlay ? 'rrInput--hasOverlay' : '',
    className ?? '',
  ]
    .join(' ')
    .trim();

  const controlClass = `rrInput__control ${controlClassName ?? ''}`.trim();

  return (
    <div className={rootCls}>
      {overlay ? (
        <div className="rrInput__overlay" aria-hidden="true">
          {overlay}
        </div>
      ) : null}
      {control === 'textarea' ? (
        <textarea ref={ref as React.Ref<HTMLTextAreaElement>} className={controlClass} disabled={disabled} {...(rest as any)} />
      ) : (
        <input
          ref={ref as React.Ref<HTMLInputElement>}
          type={htmlType}
          className={controlClass}
          disabled={disabled}
          {...(rest as any)}
        />
      )}
    </div>
  );
});

/**
 * 输入控件通用组件导出：统一边框、字号、状态与输入类型控制。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const Input = memo(InputImpl);

