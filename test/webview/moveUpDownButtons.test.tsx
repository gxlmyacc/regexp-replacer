import React from 'react';
import ReactDOM from 'react-dom';
import { describe, expect, test, vi } from 'vitest';
import { MoveUpDownButtons } from '../../webview/src/components/base/MoveUpDownButtons';

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

describe('MoveUpDownButtons', () => {
  test('点击上移/下移触发回调，disabled 时不触发', () => {
    const onUp = vi.fn();
    const onDown = vi.fn();
    const host = mount(
      <MoveUpDownButtons upDisabled={false} downDisabled={true} onUp={onUp} onDown={onDown} upAriaLabel="UP" downAriaLabel="DOWN" />,
    );
    try {
      const up = host.querySelector('button[aria-label="UP"]') as HTMLButtonElement | null;
      const down = host.querySelector('button[aria-label="DOWN"]') as HTMLButtonElement | null;
      expect(up).not.toBeNull();
      expect(down).not.toBeNull();

      up?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      down?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(onUp).toHaveBeenCalled();
      expect(onDown).not.toHaveBeenCalled();
      expect(down?.disabled).toBe(true);
    } finally {
      unmount(host);
    }
  });
});

