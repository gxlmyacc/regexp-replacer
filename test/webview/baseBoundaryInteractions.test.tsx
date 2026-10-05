import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { expect, test, vi } from 'vitest';
import { Tooltip, DropdownMenu, AutoEllipsis, VirtualList, Toast } from '../../webview/src/components/base';

function mount() { const host = document.createElement('div'); document.body.appendChild(host); return host; }
function unmount(host: HTMLElement) { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); }

test('Tooltip 延迟取消、子节点 ref 与原有事件、wrapper 焦点', () => {
  vi.useFakeTimers(); const host = mount(); const childRef = vi.fn(); const events = { onFocus: vi.fn(), onBlur: vi.fn(), onMouseEnter: vi.fn(), onMouseLeave: vi.fn() };
  try {
    act(() => { ReactDOM.render(<Tooltip content="Hint" showDelayMs={20} useChildAsHost><button ref={childRef} {...events}>Child</button></Tooltip>, host); });
    const button = host.querySelector('button')!; expect(childRef).toHaveBeenCalledWith(button);
    act(() => { Simulate.mouseEnter(button); Simulate.mouseLeave(button); vi.advanceTimersByTime(30); }); expect(document.querySelector('[role="tooltip"]')).toBeNull();
    act(() => { Simulate.focus(button); vi.advanceTimersByTime(30); }); expect(document.querySelector('[role="tooltip"]')).not.toBeNull();
    act(() => { Simulate.blur(button); }); expect(events.onBlur).toHaveBeenCalled();
    const ref = { current: null }; act(() => { ReactDOM.render(<Tooltip content="Other" useChildAsHost showDelayMs={0}><span ref={ref}>Other</span></Tooltip>, host); }); expect(ref.current).toBe(host.querySelector('span'));
    act(() => { ReactDOM.render(<Tooltip content="Wrapper" block hostClassName="custom" showDelayMs={0}>text</Tooltip>, host); }); const wrapper = host.querySelector('.rrTooltipHost')!;
    act(() => { Simulate.focus(wrapper); }); expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('Wrapper'); act(() => { Simulate.blur(wrapper); }); expect(document.querySelector('[role="tooltip"]')).toBeNull();
  } finally { unmount(host); vi.useRealTimers(); }
});

test('Dropdown 按钮提示、多选/显式指示器与菜单内点击不关闭', () => {
  const host = mount(); const toggle = vi.fn();
  try {
    for (const indicator of [undefined, 'radio', 'checkbox', 'none'] as const) {
      act(() => { ReactDOM.render(<DropdownMenu key={indicator || 'auto'} buttonLabel="Menu" buttonTitle="Hint" buttonActive buttonLabelSuffix="suffix" mode="multiple" indicator={indicator} menuTitle="Title" options={[{ id: 'a', label: 'A', checked: true }]} onToggle={toggle} />, host); });
      const button = host.querySelector('button')!; act(() => { button.click(); }); expect(document.querySelector('.rrDropdownMenu__title')?.textContent).toBe('Title');
      const item = document.querySelector('.rrDropdownMenu__item')!;
      act(() => { item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }); expect(document.querySelector('.rrDropdownMenu__item')).not.toBeNull();
      const text = item.firstChild!; act(() => { text.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }); expect(document.querySelector('.rrDropdownMenu__item')).not.toBeNull();
      act(() => { button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }); expect(document.querySelector('.rrDropdownMenu__item')).not.toBeNull();
      act(() => { Simulate.click(item); }); expect(toggle).toHaveBeenCalledWith('a');
      act(() => { document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }); expect(document.querySelector('.rrDropdownMenu__item')).toBeNull(); act(() => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    }
  } finally { unmount(host); }
});

test('省略文本与虚拟列表响应实际宽高变化和无 ResizeObserver 环境', () => {
  const host = mount(); let callback: ResizeObserverCallback;
  vi.stubGlobal('ResizeObserver', class { constructor(cb: ResizeObserverCallback) { callback = cb; } observe() {} disconnect() {} });
  try {
    act(() => { ReactDOM.render(<AutoEllipsis content="Full">Full</AutoEllipsis>, host); });
    const autoCallback = callback!;
    const span = host.querySelector('.autoEllipsisText') || host.querySelector('span')!;
    Object.defineProperty(span, 'scrollWidth', { value: 100, configurable: true }); Object.defineProperty(span, 'clientWidth', { value: 20, configurable: true });
    act(() => { callback!([], {} as ResizeObserver); }); expect(host.querySelector('.rrTooltipHost')).not.toBeNull();
    act(() => { ReactDOM.render(<VirtualList className="list" items={['A', 'B']} rowHeight={0} renderRow={i => i} />, host); });
    const list = host.querySelector('.list')!; act(() => { callback!([], {} as ResizeObserver); }); Object.defineProperty(list, 'clientHeight', { value: 60 }); act(() => { callback!([], {} as ResizeObserver); }); expect(host.textContent).toContain('A');
    vi.stubGlobal('ResizeObserver', undefined); act(() => { ReactDOM.render(<AutoEllipsis content="Full">Full</AutoEllipsis>, host); });
    act(() => { window.dispatchEvent(new Event('resize')); });
    act(() => { ReactDOM.unmountComponentAtNode(host); }); act(() => { autoCallback([], {} as ResizeObserver); });
  } finally { unmount(host); vi.unstubAllGlobals(); }
});

test('Toast 运行时鼠标暂停恢复和点击关闭', () => {
  vi.useFakeTimers();
  try {
    act(() => { Toast.show('Message', 'info', 1000); }); const toast = document.querySelector('[role="status"]')!;
    act(() => { Simulate.mouseEnter(toast); }); act(() => { vi.advanceTimersByTime(1200); }); expect(document.querySelector('[role="status"]')).not.toBeNull();
    act(() => { Simulate.mouseLeave(toast); }); act(() => { vi.advanceTimersByTime(500); }); expect(document.querySelector('[role="status"]')).not.toBeNull();
    act(() => { Simulate.mouseDown(toast); }); expect(document.querySelector('[role="status"]')).toBeNull();
  } finally { Toast.dismiss(); vi.useRealTimers(); }
});
