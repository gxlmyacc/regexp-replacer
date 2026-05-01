/**
 * 左侧菜单折叠状态持久化键（localStorage）。
 */
const LEFT_PANEL_COLLAPSED_KEY = 'regexpReplacer.leftPanelCollapsed';
const SPLITTER_TOGGLE_ARROW_VISIBLE_KEY = 'regexpReplacer.splitterToggleArrowVisible';

/**
 * 读取左侧菜单是否折叠（localStorage）；读取失败或未设置时返回 false。
 *
 * @returns 是否折叠。
 */
export function readStoredLeftPanelCollapsed(): boolean {
  try {
    return localStorage.getItem(LEFT_PANEL_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * 写入左侧菜单折叠状态（localStorage），用于下次打开面板恢复。
 *
 * @param collapsed 是否折叠。
 * @returns 无返回值。
 */
export function persistLeftPanelCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(LEFT_PANEL_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // ignore
  }
}

/**
 * 读取“Splitter 上是否显示折叠/展开箭头”配置；未设置时默认显示。
 *
 * @returns 是否显示 Splitter 箭头。
 */
export function readStoredSplitterToggleArrowVisible(): boolean {
  try {
    const raw = localStorage.getItem(SPLITTER_TOGGLE_ARROW_VISIBLE_KEY);
    if (raw === null) return true;
    return raw === '1';
  } catch {
    return true;
  }
}

/**
 * 写入“Splitter 上是否显示折叠/展开箭头”配置。
 *
 * @param visible 是否显示 Splitter 箭头。
 * @returns 无返回值。
 */
export function persistSplitterToggleArrowVisible(visible: boolean): void {
  try {
    localStorage.setItem(SPLITTER_TOGGLE_ARROW_VISIBLE_KEY, visible ? '1' : '0');
  } catch {
    // ignore
  }
}

