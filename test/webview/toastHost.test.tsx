import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { ToastHost } from '../../webview/src/components/base';

describe('ToastHost', () => {
  test('toast 为 null 时不渲染', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    ReactDOM.render(<ToastHost toast={null} onDismiss={() => {}} />, host);
    try {
      expect(host.textContent ?? '').toBe('');
    } finally {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
    }
  });

  test('支持 Escape 与鼠标点击关闭', async () => {
    const onDismiss = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      await act(async () => {
        ReactDOM.render(<ToastHost toast={{ kind: 'info', message: 'hi' }} onDismiss={onDismiss} />, host);
        // 刷新 effect：确保 keydown 监听已注册
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));
      });

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await Promise.resolve();
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);

      const el = host.querySelector('[role="status"]') as HTMLElement | null;
      await act(async () => {
        el?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        await Promise.resolve();
      });
      expect(onDismiss).toHaveBeenCalledTimes(2);
    } finally {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
    }
  });
});

