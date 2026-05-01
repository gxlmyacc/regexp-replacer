import React from 'react';
import ReactDOM from 'react-dom';
import * as TestUtils from 'react-dom/test-utils';
import { describe, expect, test } from 'vitest';
import { Tooltip } from '../../webview/src/components/base/Tooltip';

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

describe('Tooltip', () => {
  test('wrapper host：hover 显示/隐藏 tooltip（showDelayMs=0）', () => {
    const host = mount(
      <Tooltip content="C" showDelayMs={0}>
        <button type="button">btn</button>
      </Tooltip>,
    );
    try {
      const wrapper = host.querySelector('.rrTooltipHost') as HTMLElement | null;
      expect(wrapper).not.toBeNull();
      expect(document.querySelector('[role="tooltip"]')).toBeNull();

      TestUtils.act(() => {
        TestUtils.Simulate.mouseEnter(wrapper as any);
      });
      expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('C');

      TestUtils.act(() => {
        TestUtils.Simulate.mouseLeave(wrapper as any);
      });
      expect(document.querySelector('[role="tooltip"]')).toBeNull();
    } finally {
      unmount(host);
    }
  });

  test('useChildAsHost：合并事件并在 focus/blur 时显示/隐藏', () => {
    const host = mount(
      <Tooltip content="C2" useChildAsHost={true} showDelayMs={0} hostClassName="x" block={true}>
        <span className="child">child</span>
      </Tooltip>,
    );
    try {
      const child = host.querySelector('.child') as HTMLElement | null;
      expect(child).not.toBeNull();
      expect(child?.className).toContain('rrTooltipHost');
      expect(child?.className).toContain('rrTooltipHost--block');
      expect(child?.className).toContain('x');

      TestUtils.act(() => {
        child?.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
      });
      expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('C2');

      TestUtils.act(() => {
        child?.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      });
      expect(document.querySelector('[role="tooltip"]')).toBeNull();
    } finally {
      unmount(host);
    }
  });
});

