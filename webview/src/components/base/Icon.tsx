import React, { memo } from 'react';

export type IconType =
  | 'copy'
  | 'close'
  | 'edit'
  | 'add'
  | 'export'
  | 'import'
  | 'dragHandle'
  | 'caretUp'
  | 'caretDown'
  | 'arrowUp'
  | 'arrowDown'
  | 'arrowLeft'
  | 'arrowRight';


export type IconProps = Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> & {
  /**
   * 图标类型：通过 type 映射到当前项目使用的“图标文字”。
   */
  type: IconType;
};

const ICON_TEXT: Record<IconType, string> = {
  copy: '⧉',
  close: '×',
  edit: '✎',
  add: '+',
  export: '⭱',
  import: '⭳',
  dragHandle: '⋮⋮',
  caretUp: '▲',
  caretDown: '▼',
  arrowUp: '↑',
  arrowDown: '↓',
  arrowLeft: '←',
  arrowRight: '→'
};

/**
 * 轻量图标组件：用统一的 type 名称封装“图标文字”，便于全局替换与风格一致。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const Icon = memo(function Icon(props: IconProps): React.ReactElement {
  const { type, className = '', ...rest } = props;
  return (
    <span className={`rrIcon rrIcon--${type} ${className}`.trim()} aria-hidden="true" {...rest}>
      {ICON_TEXT[type]}
    </span>
  );
});

