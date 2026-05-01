import React from 'react';
import ReactDOM from 'react-dom';
import { describe, expect, test, vi } from 'vitest';
import { DropdownMenu } from '../../webview/src/components/base';

describe('DropdownMenu', () => {
  test('点击按钮打开菜单，点击选项触发 onToggle', async () => {
    const onToggle = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    ReactDOM.render(
      <DropdownMenu
        buttonLabel="Lang"
        mode="single"
        options={[
          { id: 'en', label: 'English', checked: true },
          { id: 'zh', label: '中文' },
        ]}
        onToggle={onToggle}
      />,
      host,
    );
    try {
      const btn = host.querySelector('button') as HTMLButtonElement | null;
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
      await Promise.resolve();
      expect(document.body.textContent?.includes('English')).toBe(true);
      const zh = Array.from(document.body.querySelectorAll('.rrDropdownMenu__item')).find((n) => n.textContent?.includes('中文')) as
        | HTMLElement
        | undefined;
      zh?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onToggle).toHaveBeenCalledWith('zh');
    } finally {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
    }
  });

  test('closeOnToggle 会关闭菜单；disabled 选项不触发', async () => {
    const onToggle = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    ReactDOM.render(
      <DropdownMenu
        buttonLabel="Menu"
        mode="single"
        closeOnToggle
        options={[
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B', disabled: true },
        ]}
        onToggle={onToggle}
      />,
      host,
    );
    try {
      const btn = host.querySelector('button') as HTMLButtonElement | null;
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
      const b = Array.from(document.body.querySelectorAll('.rrDropdownMenu__item')).find((n) => n.textContent === 'B') as
        | HTMLElement
        | undefined;
      b?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onToggle).not.toHaveBeenCalled();

      const a = Array.from(document.body.querySelectorAll('.rrDropdownMenu__item')).find((n) => n.textContent === 'A') as
        | HTMLElement
        | undefined;
      a?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onToggle).toHaveBeenCalledWith('a');
      // closeOnToggle：菜单关闭后，popoverItem 不存在
      await Promise.resolve();
      expect(document.body.querySelector('.rrDropdownMenu__item')).toBeNull();
    } finally {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
    }
  });

  test('点击外部区域会关闭菜单', async () => {
    const onToggle = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    ReactDOM.render(
      <div>
        <DropdownMenu buttonLabel="Menu" mode="single" options={[{ id: 'a', label: 'A' }]} onToggle={onToggle} />
        <div>outside</div>
      </div>,
      host,
    );
    try {
      const btn = host.querySelector('button') as HTMLButtonElement | null;
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
      expect(document.body.textContent?.includes('A')).toBe(true);
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
      expect(document.body.querySelector('.rrDropdownMenu__item')).toBeNull();
    } finally {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
    }
  });
});

