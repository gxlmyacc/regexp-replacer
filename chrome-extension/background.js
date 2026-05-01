/**
 * Chrome 扩展后台脚本：点击工具栏按钮打开 RegExp UI 页面。
 *
 * @returns 无返回值。
 */
function registerOpenUiTab() {
  chrome.action.onClicked.addListener(async () => {
    const url = chrome.runtime.getURL('ui/index.html');
    await chrome.tabs.create({ url });
  });
}

registerOpenUiTab();

