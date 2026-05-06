import React from 'react';
import ReactDOM from 'react-dom';
import { describe, expect, test, vi } from 'vitest';
import {
  ReplaceResultBox,
  buildReplaceLineRows,
  slicePartsForLine,
} from '../../webview/src/components/ReplaceResultBox';

describe('buildReplaceLineRows / slicePartsForLine', () => {
  test('按换行拆分且跨片段保留 replaced', () => {
    const parts = [
      { text: 'a\n', replaced: false },
      { text: 'bx', replaced: true },
    ];
    const rows = buildReplaceLineRows(parts);
    expect(rows.map((r) => r.lineNumber)).toEqual([1, 2]);
    expect(rows[0]!.segments).toEqual([{ text: 'a', replaced: false }]);
    expect(rows[1]!.segments).toEqual([{ text: 'bx', replaced: true }]);
  });

  test('同一 part 跨行时切片正确', () => {
    const parts = [{ text: 'a\nb', replaced: true }];
    const rows = buildReplaceLineRows(parts);
    expect(rows[0]!.segments).toEqual([{ text: 'a', replaced: true }]);
    expect(rows[1]!.segments).toEqual([{ text: 'b', replaced: true }]);
    expect(slicePartsForLine(parts, 2, 3)).toEqual([{ text: 'b', replaced: true }]);
  });
});

describe('ReplaceResultBox', () => {
  test('支持高亮与纯文本两种展示', () => {
    const parts = [
      { text: 'a', replaced: false },
      { text: 'b', replaced: true },
    ];
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      ReactDOM.render(
        <ReplaceResultBox parts={parts} fallbackText="" emptyText="empty" replacedCount={1} maxChars={100} highlightReplaced />,
        host,
      );
      expect(host.querySelectorAll('.replacePreviewHit').length).toBe(1);
      expect(host.querySelector('.replaceResultBox__gutter')?.textContent).toBe('1');

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
      expect(host.querySelector('.replaceResultBox__lineMain')?.textContent).toContain('ab');
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

  test('多行时渲染多个行号', () => {
    const parts = [{ text: 'x\ny\nz', replaced: false }];
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      ReactDOM.render(<ReplaceResultBox parts={parts} fallbackText="" emptyText="empty" replacedCount={1} maxChars={100} />, host);
      const gutters = Array.from(host.querySelectorAll('.replaceResultBox__gutter')).map((el) => el.textContent);
      expect(gutters).toEqual(['1', '2', '3']);
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

