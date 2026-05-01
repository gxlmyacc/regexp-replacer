import React from 'react';
import ReactDOM from 'react-dom';
import { describe, expect, test, vi } from 'vitest';
import { RuleTitleEditor } from '../../webview/src/components/RuleTitleEditor';

describe('RuleTitleEditor', () => {
  test('点击进入编辑，失焦提交（空值提交为 undefined）', () => {
    const onCommit = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    ReactDOM.render(<RuleTitleEditor value={undefined} fallbackLabel="Rule 1" placeholder="title" onCommit={onCommit} />, host);
    try {
      const btn = host.querySelector('button') as HTMLButtonElement | null;
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const input = host.querySelector('input') as HTMLInputElement | null;
      expect(input).not.toBeNull();
      if (!input) return;
      input.value = '   ';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      expect(onCommit).toHaveBeenCalledWith(undefined);
    } finally {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
    }
  });

  test('规则标题输入可正常提交（业务侧另做保留字符校验）', () => {
    const onCommit = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    ReactDOM.render(<RuleTitleEditor value="Hello" fallbackLabel="Rule 1" placeholder="title" onCommit={onCommit} />, host);
    try {
      const btn = host.querySelector('button') as HTMLButtonElement | null;
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const input = host.querySelector('input') as HTMLInputElement | null;
      expect(input).not.toBeNull();
      if (!input) return;
      // React 16 需要通过原生 setter 修改 value，才能确保触发受控输入的 onChange。
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'Rule Title 1');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
      expect(onCommit).toHaveBeenCalledWith('Rule Title 1');
    } finally {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
    }
  });

  test('Escape 取消编辑不提交', () => {
    const onCommit = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    ReactDOM.render(<RuleTitleEditor value="Hello" fallbackLabel="Rule 1" placeholder="title" onCommit={onCommit} />, host);
    try {
      const btn = host.querySelector('button') as HTMLButtonElement | null;
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const input = host.querySelector('input') as HTMLInputElement | null;
      expect(input).not.toBeNull();
      if (!input) return;
      input.value = 'World';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(onCommit).not.toHaveBeenCalled();
    } finally {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
    }
  });
});

