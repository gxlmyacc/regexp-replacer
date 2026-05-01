import React, { memo } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import './MoveUpDownButtons.scss';

export type MoveUpDownButtonsProps = {
  /**
   * 是否禁用“上移”按钮。
   */
  upDisabled: boolean;
  /**
   * 是否禁用“下移”按钮。
   */
  downDisabled: boolean;
  /**
   * 点击“上移”的回调。
   */
  onUp: () => void;
  /**
   * 点击“下移”的回调。
   */
  onDown: () => void;
  /**
   * “上移”按钮的 aria-label（用于无障碍）。
   */
  upAriaLabel?: string;
  /**
   * “下移”按钮的 aria-label（用于无障碍）。
   */
  downAriaLabel?: string;
};

/**
 * 行排序按钮组：提供“上移/下移”两个箭头按钮，用于在列表中调整当前条目的顺序。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const MoveUpDownButtons = memo(function MoveUpDownButtons(props: MoveUpDownButtonsProps): React.ReactElement {
  const { upDisabled, downDisabled, onUp, onDown, upAriaLabel = '上移', downAriaLabel = '下移' } = props;

  return (
    <div className="rrMoveUpDownButtons">
      <Button
        variant="icon"
        size="sm"
        className="rrMoveUpDownButtonsBtn"
        disabled={upDisabled}
        onClick={onUp}
        aria-label={upAriaLabel}
      >
        <Icon type="caretUp" />
      </Button>
      <Button
        variant="icon"
        size="sm"
        className="rrMoveUpDownButtonsBtn"
        disabled={downDisabled}
        onClick={onDown}
        aria-label={downAriaLabel}
      >
        <Icon type="caretDown" />
      </Button>
    </div>
  );
});

