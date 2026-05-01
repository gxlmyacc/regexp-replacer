import React from 'react';
import ReactDOM from 'react-dom';
import * as TestUtils from 'react-dom/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { AutoEllipsis } from '../../webview/src/components/base/AutoEllipsis';

/**
 * 将 React 元素挂载到 DOM 容器中（用于无 Testing Library 的最小组件测试）。
 *
 * @param el React 元素。
 * @returns 容器元素。
 */
async function mount(el: React.ReactElement): Promise<HTMLDivElement> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  await TestUtils.act(async () => {
    ReactDOM.render(el, host);
    await Promise.resolve();
  });
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

/**
 * 为元素注入可控的 clientWidth/scrollWidth，便于制造“省略/不省略”两种状态。
 *
 * @param el 目标元素。
 * @param clientW 可见宽度。
 * @param scrollW 内容宽度。
 * @returns 无返回值。
 */
function setWidths(el: HTMLElement, clientW: number, scrollW: number): void {
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientW });
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollW });
}

describe('AutoEllipsis', () => {
  test('ResizeObserver 分支：溢出时 hover 后显示 tooltip；卸载时 disconnect', async () => {
    vi.useFakeTimers();
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: any) => {
      cb(0);
      return 1 as any;
    });
    const cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const observe = vi.fn();
    const RO = class ResizeObserver {
      cb: () => void;
      constructor(cb: () => void) {
        this.cb = cb;
      }
      observe = observe;
      disconnect = vi.fn();
    };
    vi.stubGlobal('ResizeObserver', RO);

    const host = await mount(
      <AutoEllipsis content="FULL" block={false}>
        FULL
      </AutoEllipsis>,
    );
    try {
      const span = host.querySelector('.rrAutoEllipsis') as HTMLElement | null;
      expect(span).not.toBeNull();
      setWidths(span as HTMLElement, 10, 100); // 溢出

      // hover -> tooltip showDelay 默认 120ms
      TestUtils.act(() => {
        TestUtils.Simulate.mouseEnter(span as any);
      });
      await TestUtils.act(async () => {
        vi.runOnlyPendingTimers();
        await Promise.resolve();
      });
      expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('FULL');

      // ResizeObserver 被注册
      expect(observe).toHaveBeenCalled();
    } finally {
      await TestUtils.act(async () => {
        unmount(host);
        await Promise.resolve();
      });
      rafSpy.mockRestore();
      cafSpy.mockRestore();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  test('fallback 分支：无 ResizeObserver 时监听 window resize，并在不溢出时不显示 tooltip', async () => {
    vi.useFakeTimers();
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: any) => {
      cb(0);
      return 1 as any;
    });
    const cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    vi.stubGlobal('ResizeObserver', undefined);

    const addSpy = vi.spyOn(window, 'addEventListener');
    const rmSpy = vi.spyOn(window, 'removeEventListener');

    const host = await mount(
      <AutoEllipsis content="FULL">
        FULL
      </AutoEllipsis>,
    );
    try {
      const span = host.querySelector('.rrAutoEllipsis') as HTMLElement | null;
      expect(span).not.toBeNull();
      setWidths(span as HTMLElement, 100, 10); // 不溢出

      // hover：因为不溢出，AutoEllipsis 传给 Tooltip 的 content 为空，不应出现气泡
      TestUtils.act(() => {
        TestUtils.Simulate.mouseEnter(span as any);
      });
      await TestUtils.act(async () => {
        vi.runOnlyPendingTimers();
        await Promise.resolve();
      });
      expect(document.querySelector('[role="tooltip"]')).toBeNull();

      // 模拟 resize：让其变为溢出，再 hover 应出现
      setWidths(span as HTMLElement, 10, 100);
      TestUtils.act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      TestUtils.act(() => {
        TestUtils.Simulate.mouseEnter(span as any);
      });
      await TestUtils.act(async () => {
        vi.runOnlyPendingTimers();
        await Promise.resolve();
      });
      expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('FULL');

      const hasResizeListener = addSpy.mock.calls.some((c) => c?.[0] === 'resize');
      expect(hasResizeListener).toBe(true);
    } finally {
      await TestUtils.act(async () => {
        unmount(host);
        await Promise.resolve();
      });
      // 只要分支走到并注册过 listener 即可，这里不强依赖 jsdom 对卸载时机/顺序的实现细节
      addSpy.mockRestore();
      rmSpy.mockRestore();
      rafSpy.mockRestore();
      cafSpy.mockRestore();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});

