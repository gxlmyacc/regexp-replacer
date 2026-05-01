import React from 'react';
import ReactDOM from 'react-dom';
import { describe, expect, test, vi } from 'vitest';
import { LeftPanelCollapseRail } from '../../webview/src/components/LeftPanelCollapseRail';
import { I18nProvider } from '../../webview/src/i18n/I18nProvider';

/**
 * 将 React 元素挂载到 DOM 容器中（用于无 Testing Library 的最小组件测试）。
 *
 * @param el React 元素。
 * @returns 容器元素。
 */
function mount(el: React.ReactElement): HTMLDivElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  ReactDOM.render(el, host);
  return host;
}

/**
 * 卸载并移除容器，避免测试间污染。
 *
 * @param host 容器。
 * @returns 无返回值。
 */
function unmount(host: HTMLDivElement): void {
  ReactDOM.unmountComponentAtNode(host);
  host.remove();
}

describe('LeftPanelCollapseRail', () => {
  test('点击展开按钮会触发 onExpand', () => {
    const onExpand = vi.fn();
    const host = mount(
      <I18nProvider>
        <LeftPanelCollapseRail onExpand={onExpand} expandTitle="展开侧边栏" />
      </I18nProvider>,
    );
    try {
      const btn = host.querySelector('button[aria-label="展开侧边栏"]') as HTMLButtonElement | null;
      expect(btn).not.toBeNull();
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onExpand).toHaveBeenCalled();
    } finally {
      unmount(host);
    }
  });
});

