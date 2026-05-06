import React from 'react';
import ReactDOM from 'react-dom';
import { describe, expect, test, vi } from 'vitest';
import { ListResultPanel } from '../../webview/src/components/ListResultPanel';

describe('ListResultPanel', () => {
  test('超出 maxItems 会触发截断回调（仅一次）', () => {
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

  test('多行 matchText 按自然行高展示', () => {
    const matches = [{ matchText: '00:00:01,000 --> 00:00:02,000\nう\n唔' }];
    const host = document.createElement('div');
    host.style.height = '200px';
    document.body.appendChild(host);
    try {
      ReactDOM.render(<ListResultPanel matches={matches as any} maxItems={10} />, host);
      const cell = host.querySelector('.listRowText');
      expect(cell).not.toBeNull();
      expect(cell?.textContent).toContain('00:00:01');
      expect(cell?.textContent).toContain('唔');
    } finally {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
    }
  });

  test('Ctrl+A 会触发 onCtrlA', () => {
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
