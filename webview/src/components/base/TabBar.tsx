import React, { memo } from 'react';
import { Button } from './Button';
import './TabBar.scss';

export type TabBarOption = {
  label: string;
  value: string;
};

export type TabBarProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  /**
   * 当前激活的标签 key。
   */
  value: string;
  /**
   * 标签列表。
   */
  options: Array<TabBarOption>;
  /**
   * 切换标签时触发。
   *
   * @param value 目标标签 value。
   * @returns 无返回值。
   */
  onChange: (value: string) => void;
  /**
   * 右侧自定义区域（例如复制按钮）。
   */
  extra?: React.ReactNode;
};

/**
 * 通用标签栏组件：根据 options 渲染标签，并支持右侧 extra 区域。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const TabBar = memo(function TabBar(props: TabBarProps): React.ReactElement {
  const { value, options, extra, onChange, className = '', ...rest } = props;
  return (
    <div className={`rrTabBar ${className}`.trim()} {...rest}>
      {options.map((opt) => (
        <Button key={opt.value} preset="tab" active={value === opt.value} onClick={() => onChange(opt.value)}>
          {opt.label}
        </Button>
      ))}
      <div className="rrTabBar__extra">{extra}</div>
    </div>
  );
});

