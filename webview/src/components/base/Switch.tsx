import React, { memo } from 'react';
import './Switch.scss';

export type SwitchOption<T extends string> = {
  key: T;
  label: string;
};

export type SwitchProps<T extends string> = {
  value: T;
  options: Array<SwitchOption<T>>;
  onChange: (next: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
};

/**
 * 通用分段式开关组件：根据传入 options 渲染可变数量的开关项。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const Switch = memo(function Switch<T extends string>(props: SwitchProps<T>): React.ReactElement {
  const { value, options, onChange, disabled, ariaLabel } = props;
  return (
    <div className={`rrSwitch ${disabled ? 'rrSwitchDisabled' : ''}`.trim()} aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          className={`rrSwitchBtn ${value === opt.key ? 'rrSwitchBtnActive' : ''}`.trim()}
          onClick={() => onChange(opt.key)}
          disabled={disabled}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
});

