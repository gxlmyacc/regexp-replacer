import React, { memo } from 'react';
import { Tooltip } from './Tooltip';
import './Checkbox.scss';

export type CheckboxProps = {
  checked: boolean;
  onChange: (nextChecked: boolean) => void;
  disabled?: boolean;
  /** hover 气泡提示。 */
  tooltip: string;
  /** 无障碍标签。 */
  ariaLabel: string;
  className?: string;
};

/**
 * 通用复选框组件：不展示文字，仅提供 hover 气泡提示与无障碍标签。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const Checkbox = memo(function Checkbox(props: CheckboxProps): React.ReactElement {
  const { checked, onChange, disabled, tooltip, ariaLabel, className } = props;

  const node = (
    <input
      className={`${className ?? ''} rrCheckbox`.trim()}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
  return tooltip ? <Tooltip content={tooltip}>{node}</Tooltip> : node;
});

