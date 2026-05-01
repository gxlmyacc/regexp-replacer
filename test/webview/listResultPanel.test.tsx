import React from 'react';
import ReactDOM from 'react-dom';
import { describe, expect, test, vi } from 'vitest';
import { ListResultPanel } from '../../webview/src/components/ListResultPanel';

describe('ListResultPanel', () => {
  /**
   * 为 JSDOM 注入最小 ResizeObserver，满足 VirtualList 的依赖。
   *
   * @returns 无返回值。
   */
  function ensureResizeObserver(): void {
    (globalThis as any).ResizeObserver =
      (globalThis as any).ResizeObserver ??
      class ResizeObserver {
        observe() {}
        disconnect() {}
      };
  }

  test('超出 maxItems 会触发截断回调（仅一次）', () => {
    ensureResizeObserver();
    const onTruncated = vi.fn();
    const matches = Array.from({ length: 5 }, (_, i) => ({ matchText: `m${i}` }));
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      ReactDOM.render(<ListResultPanel matches={matches as any} maxItems={2} onTruncated={onTruncated} />, host);
      expect(onTruncated).toHaveBeenCalledTimes(1);

      ReactDOM.render(<ListResultPanel matches={matches as any} maxItems={2} onTruncated={onTruncated} />, host);
      expect(onTruncated).toHaveBeenCalledTimes(1);
    } finally {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
    }
  });

  test('Ctrl+A 会触发 onCtrlA', () => {
    ensureResizeObserver();
    const onCtrlA = vi.fn();
    const matches = [{ matchText: 'x' }];
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      ReactDOM.render(<ListResultPanel matches={matches as any} maxItems={10} onCtrlA={onCtrlA} />, host);
      const list = host.querySelector('[role="list"]') as HTMLElement | null;
      list?.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, cancelable: true }));
      expect(onCtrlA).toHaveBeenCalledTimes(1);
    } finally {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
    }
  });
});

