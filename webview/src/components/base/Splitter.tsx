import React, { memo } from 'react';
import { Tooltip } from './Tooltip';
import './Splitter.scss';

export type SplitterOrientation = 'vertical' | 'horizontal';

export type SplitterProps = {
  orientation: SplitterOrientation;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  className?: string;
  toggleButton?: {
    visible: boolean;
    title: string;
    label: string;
    onClick: () => void;
  };
};

/**
 * 拖拽分割条：封装 splitterV/splitterH 的语义、样式与无障碍属性。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const Splitter = memo(function Splitter(props: SplitterProps): React.ReactElement {
  const { orientation, onMouseDown, className = '', toggleButton } = props;
  const cls = orientation === 'vertical' ? 'rrSplitter rrSplitterV' : 'rrSplitter rrSplitterH';
  return (
    <div
      className={`${cls} ${className}`.trim()}
      role="separator"
      aria-orientation={orientation}
      onMouseDown={onMouseDown}
    >
      {toggleButton?.visible ? (
        <Tooltip content={toggleButton.title} useChildAsHost>
          <button
            type="button"
            className={`rrSplitterToggle rrSplitterToggle--${orientation}`}
            aria-label={toggleButton.title}
            onMouseDown={(e) => {
              // 点击箭头不触发拖拽。
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              toggleButton.onClick();
            }}
          >
            {toggleButton.label}
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
});

