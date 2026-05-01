import React, { memo } from 'react';
import { Button, Tooltip } from './base';
import './LeftPanelCollapseRail.scss';

export type LeftPanelCollapseRailProps = {
  /**
   * 展开侧边栏。
   *
   * @returns 无返回值。
   */
  onExpand: () => void;
  expandTitle: string;
};

/**
 * 左侧菜单折叠态：仅显示一条窄边栏与“展开”按钮。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const LeftPanelCollapseRail = memo(function LeftPanelCollapseRail(props: LeftPanelCollapseRailProps): React.ReactElement {
  const { onExpand, expandTitle } = props;
  return (
    <div className="leftPanelRail">
      <Tooltip content={expandTitle}>
        <Button preset="topIcon" aria-label={expandTitle} onClick={onExpand}>
          »
        </Button>
      </Tooltip>
    </div>
  );
});

