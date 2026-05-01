import React from 'react';
import ReactDOM from 'react-dom';
import * as TestUtils from 'react-dom/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { HookDependencyConfirmModal } from '../../webview/src/components/base/HookDependencyConfirmModal';

const endModalSpy = vi.fn();

const mockReferrerRows = [
  {
    key: 'cmd1\t0\tpre',
    entry: { sourceCommandId: 'cmd1', sourceTitle: 'C1', ruleIndex: 0, phase: 'pre' as const },
    label: 'pre: Rule 1',
  },
  {
    key: 'cmd2\t0\tpost',
    entry: { sourceCommandId: 'cmd2', sourceTitle: 'C2', ruleIndex: 0, phase: 'post' as const },
    label: 'post: Rule 2',
  },
];

vi.mock('use-modal-ref', () => {
  return {
    __esModule: true,
    /**
     * useModalRef mock：让弹窗直接处于 visible=true，并提供 endModal 捕获返回值。
     *
     * @returns { modal, data }
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    default: (_ref: any, defaults: any) => {
      return {
        modal: { visible: true, endModal: endModalSpy },
        data: {
          ...defaults,
          title: 'T',
          intro: 'I',
          referrerBlocks: [],
          referrerRows: mockReferrerRows,
          referrerRowCheckboxAria: 'row aria',
          cancelText: '取消',
          okText: '确定',
          danger: false,
          showRemoveFromOthersCheckbox: true,
          removeFromOthersLabel: '同时移除引用',
        },
      };
    },
  };
});

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

describe('HookDependencyConfirmModal', () => {
  test('默认勾选主开关与各行，确定后回传全部条目到 referrerEntriesToStrip', () => {
    endModalSpy.mockClear();
    const host = mount(<HookDependencyConfirmModal ref={null as any} />);
    try {
      expect(host.textContent).toContain('C1');
      expect(host.textContent).toContain('cmd1');

      const cbs = host.querySelectorAll('input[type="checkbox"]');
      expect(cbs.length).toBe(3);

      const okBtn = Array.from(host.querySelectorAll('button')).find((b) => (b as HTMLButtonElement).textContent?.includes('确定'));
      expect(okBtn).toBeTruthy();
      TestUtils.act(() => {
        TestUtils.Simulate.click(okBtn!);
      });

      expect(endModalSpy).toHaveBeenCalled();
      const payload = endModalSpy.mock.calls.at(-1)?.[0];
      expect(payload?.ok).toBe(true);
      expect(payload?.removeFromOthers).toBe(true);
      expect(payload?.referrerEntriesToStrip?.length).toBe(2);
      expect(payload?.referrerEntriesToStrip?.map((e: { phase: string }) => e.phase).sort().join(',')).toBe('post,pre');
    } finally {
      unmount(host);
    }
  });

  test('取消主开关后确定，不移除任何引用', () => {
    endModalSpy.mockClear();
    const host = mount(<HookDependencyConfirmModal ref={null as any} />);
    try {
      const master = host.querySelector('[data-rr-hook-dep-master]') as HTMLInputElement | null;
      expect(master).not.toBeNull();
      TestUtils.act(() => {
        TestUtils.Simulate.change(master!, { target: { checked: false } } as any);
      });

      const okBtn = Array.from(host.querySelectorAll('button')).find((b) => (b as HTMLButtonElement).textContent?.includes('确定'));
      TestUtils.act(() => {
        TestUtils.Simulate.click(okBtn!);
      });

      const payload = endModalSpy.mock.calls.at(-1)?.[0];
      expect(payload).toEqual({ ok: true, removeFromOthers: false, referrerEntriesToStrip: [] });
    } finally {
      unmount(host);
    }
  });

  test('主开关勾选时取消首行引用，确定后仅 strip 仍勾选的条目', () => {
    endModalSpy.mockClear();
    const host = mount(<HookDependencyConfirmModal ref={null as any} />);
    try {
      const rowInputs = host.querySelectorAll('input[data-rr-hook-dep-row]');
      expect(rowInputs.length).toBeGreaterThan(0);
      const firstRow = rowInputs[0] as HTMLInputElement;
      TestUtils.act(() => {
        TestUtils.Simulate.change(firstRow, { target: { checked: false } } as any);
      });

      const okBtn = Array.from(host.querySelectorAll('button')).find((b) => (b as HTMLButtonElement).textContent?.includes('确定'));
      TestUtils.act(() => {
        TestUtils.Simulate.click(okBtn!);
      });

      const payload = endModalSpy.mock.calls.at(-1)?.[0];
      expect(payload?.ok).toBe(true);
      expect(payload?.removeFromOthers).toBe(true);
      expect(payload?.referrerEntriesToStrip?.length).toBe(1);
      expect(payload?.referrerEntriesToStrip?.[0]?.phase).toBe('post');
    } finally {
      unmount(host);
    }
  });

  test('点击取消会回传 ok=false 且 strip 为空', () => {
    endModalSpy.mockClear();
    const host = mount(<HookDependencyConfirmModal ref={null as any} />);
    try {
      const cancelBtn = Array.from(host.querySelectorAll('button')).find((b) => (b as HTMLButtonElement).textContent?.includes('取消'));
      TestUtils.act(() => {
        TestUtils.Simulate.click(cancelBtn!);
      });
      const payload = endModalSpy.mock.calls.at(-1)?.[0];
      expect(payload).toEqual({ ok: false, removeFromOthers: false, referrerEntriesToStrip: [] });
    } finally {
      unmount(host);
    }
  });
});
