import { useCallback, useState } from 'react';
import { persistLeftPanelCollapsed, readStoredLeftPanelCollapsed, readStoredSplitterToggleArrowVisible } from '../../../utils/storage';

export type LayoutPersistence = {
  /**
   * 左侧面板是否折叠。
   */
  leftCollapsed: boolean;
  /**
   * splitter 折叠箭头是否可见（受持久化开关控制）。
   */
  showSplitterToggleArrow: boolean;
  /**
   * 设置折叠状态并写入本地持久化。
   *
   * @param collapsed 是否折叠。
   * @returns 无返回值。
   */
  setLeftCollapsedAndPersist: (collapsed: boolean) => void;
};

/**
 * 布局持久化 hook：封装左侧折叠状态的读取/写入，以及 splitter 折叠箭头可见性的读取。
 *
 * @returns 布局持久化相关状态与方法。
 */
export function useLayoutPersistence(): LayoutPersistence {
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() => readStoredLeftPanelCollapsed());
  const [showSplitterToggleArrow] = useState<boolean>(() => readStoredSplitterToggleArrowVisible());

  const setLeftCollapsedAndPersist = useCallback((collapsed: boolean): void => {
    setLeftCollapsed(collapsed);
    persistLeftPanelCollapsed(collapsed);
  }, []);

  return { leftCollapsed, showSplitterToggleArrow, setLeftCollapsedAndPersist };
}

