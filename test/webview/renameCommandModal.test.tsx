import React from 'react';
import ReactDOM from 'react-dom';
import * as TestUtils from 'react-dom/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { RenameCommandModal } from '../../webview/src/components/RenameCommandModal';

const endModalSpy = vi.fn();
const cancelModalSpy = vi.fn();

vi.mock('use-modal-ref', () => {
  return {
    __esModule: true,
    default: (_ref: any, defaults: any) => {
      return {
        modal: { visible: true, endModal: endModalSpy, cancelModal: cancelModalSpy },
        data: {
          ...defaults,
          title: 'T',
          initialValue: '',
          placeholder: '命令名称',
          cancelText: '取消',
          okText: '确定',
          validateName: (v: string) => (v.includes('x') ? 'bad' : undefined),
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
  TestUtils.act(() => {
    ReactDOM.render(el, host);
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

describe('RenameCommandModal', () => {
  test('点击确定：校验通过则 endModal；失败则显示错误且不 endModal', () => {
    endModalSpy.mockClear();
    cancelModalSpy.mockClear();
    const host = mount(<RenameCommandModal ref={null as any} />);
    try {
      const input = host.querySelector('input.rrInput__control') as HTMLInputElement | null;
      expect(input).not.toBeNull();

      // 输入非法值（包含 x）
      TestUtils.act(() => {
        TestUtils.Simulate.change(input as any, { target: { value: 'x' } });
      });
      const okBtn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('确定'));
      TestUtils.act(() => {
        okBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(endModalSpy).not.toHaveBeenCalled();
      expect(host.textContent).toContain('bad');

      // 改成合法值再确认
      TestUtils.act(() => {
        TestUtils.Simulate.change(input as any, { target: { value: 'ok' } });
      });
      TestUtils.act(() => {
        okBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(endModalSpy).toHaveBeenCalledWith('ok');
    } finally {
      unmount(host);
    }
  });

  test('点击取消：调用 cancelModal', () => {
    cancelModalSpy.mockClear();
    const host = mount(<RenameCommandModal ref={null as any} />);
    try {
      const cancelBtn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('取消'));
      TestUtils.act(() => {
        cancelBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(cancelModalSpy).toHaveBeenCalled();
    } finally {
      unmount(host);
    }
  });
});

