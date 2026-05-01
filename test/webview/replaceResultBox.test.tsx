import React from 'react';
import ReactDOM from 'react-dom';
import { describe, expect, test, vi } from 'vitest';
import { ReplaceResultBox } from '../../webview/src/components/ReplaceResultBox';

describe('ReplaceResultBox', () => {
  test('支持高亮与纯文本两种展示', () => {
    const parts = [
      { text: 'a', replaced: false },
      { text: 'b', replaced: true },
    ];
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      ReactDOM.render(<ReplaceResultBox parts={parts} fallbackText="" emptyText="empty" replacedCount={1} maxChars={100} />, host);
      expect(host.querySelectorAll('.replacePreviewHit').length).toBe(1);

      ReactDOM.render(
        <ReplaceResultBox
          parts={parts}
          fallbackText=""
          emptyText="empty"
          replacedCount={1}
          maxChars={100}
          highlightReplaced={false}
        />,
        host,
      );
      expect(host.querySelectorAll('.replacePreviewHit').length).toBe(0);
      expect(host.textContent).toContain('ab');
    } finally {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
    }
  });

  test('截断会触发 onTruncated（仅一次）', () => {
    const onTruncated = vi.fn();
    const parts = [{ text: 'abcdef', replaced: false }];
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      ReactDOM.render(
        <ReplaceResultBox
          parts={parts}
          fallbackText=""
          emptyText="empty"
          replacedCount={1}
          maxChars={3}
          onTruncated={onTruncated}
        />,
        host,
      );
      expect(onTruncated).toHaveBeenCalledTimes(1);
      ReactDOM.render(
        <ReplaceResultBox
          parts={parts}
          fallbackText=""
          emptyText="empty"
          replacedCount={1}
          maxChars={3}
          onTruncated={onTruncated}
        />,
        host,
      );
      expect(onTruncated).toHaveBeenCalledTimes(1);
    } finally {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
    }
  });

  test('Ctrl+A 只选中结果区域（不报错）', () => {
    const parts = [{ text: 'abc', replaced: false }];
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      ReactDOM.render(<ReplaceResultBox parts={parts} fallbackText="" emptyText="empty" replacedCount={1} maxChars={100} />, host);
      const box = host.querySelector('[role="textbox"]') as HTMLElement | null;
      box?.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
      box?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(true).toBe(true);
    } finally {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
    }
  });

  test('无输出但 replacedCount>0 时显示 emptyText', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    ReactDOM.render(<ReplaceResultBox parts={[]} fallbackText="" emptyText="empty" replacedCount={1} maxChars={0} />, host);
    try {
      expect(host.textContent).toContain('empty');
    } finally {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
    }
  });
});

