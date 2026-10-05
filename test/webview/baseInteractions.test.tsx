import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Layout } from '../../webview/src/components/base/Layout';
import { Splitter } from '../../webview/src/components/base/Splitter';
import { Modal } from '../../webview/src/components/base/Modal';
import { Checkbox } from '../../webview/src/components/base/Checkbox';
import { Switch } from '../../webview/src/components/base/Switch';

let host: HTMLDivElement;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); });
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); });
function render(element: React.ReactElement): void { act(() => { ReactDOM.render(element, host); }); }

test('all layout regions forward content, classes, styles and client ref', () => {
  const ref = React.createRef<HTMLDivElement>();
  render(<Layout className="custom"><Layout.Client ref={ref} style={{ height: 30 }}>
    <Layout.Sider>sider</Layout.Sider><Layout.Header>header</Layout.Header><Layout.Content>content</Layout.Content>
    <Layout.Footer>footer</Layout.Footer><Layout.Row gap={12} align="end" justify="space-between">row</Layout.Row>
  </Layout.Client></Layout>);
  expect(host.firstElementChild!.classList.contains('custom')).toBe(true);
  expect(ref.current!.style.height).toBe('30px');
  expect(host.querySelector('.rrLayout__footer')!.textContent).toBe('footer');
  expect((host.querySelector('.rrLayout__row') as HTMLElement).style.gap).toBe('12px');
});

test('splitter toggle prevents drag propagation while separator initiates dragging', () => {
  const drag = vi.fn(); const toggle = vi.fn();
  render(<Splitter orientation="vertical" onMouseDown={drag} toggleButton={{ visible: true, title: 'collapse', label: '<', onClick: toggle }} />);
  const button = host.querySelector('button')!;
  act(() => { button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); button.click(); });
  expect(drag).not.toHaveBeenCalled(); expect(toggle).toHaveBeenCalledOnce();
  act(() => { host.querySelector('[role="separator"]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
  expect(drag).toHaveBeenCalledOnce();
  render(<Splitter orientation="horizontal" onMouseDown={drag} toggleButton={{ visible: false, title: '', label: '', onClick: toggle }} />);
  expect(host.querySelector('button')).toBeNull();
  expect(host.querySelector('[aria-orientation="horizontal"]')).not.toBeNull();
});

test('modal handles escape, overlay, inner clicks and cleans up listeners on close', () => {
  const cancel = vi.fn();
  render(<Modal open onCancel={cancel} width={320} footer={<span>footer</span>}>body</Modal>);
  expect((host.querySelector('[role="dialog"]') as HTMLElement).style.width).toBe('320px');
  act(() => {
    host.querySelector('[role="dialog"]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  });
  expect(cancel).not.toHaveBeenCalled();
  act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
  expect(cancel).toHaveBeenCalledOnce();
  act(() => { host.querySelector('.rrModal__overlay')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
  expect(cancel).toHaveBeenCalledTimes(2);
  render(<Modal open={false} onCancel={cancel}>body</Modal>);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(host.childElementCount).toBe(0); expect(cancel).toHaveBeenCalledTimes(2);
});

test('checkbox without tooltip and disabled switch preserve input semantics', () => {
  const change = vi.fn();
  render(<Checkbox checked={false} onChange={change} tooltip="" ariaLabel="toggle" className="custom" />);
  act(() => { host.querySelector('input')!.click(); });
  expect(change).toHaveBeenCalledWith(true);
  render(<Switch value="a" options={[{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]} onChange={change} disabled ariaLabel="mode" />);
  act(() => { host.querySelectorAll('button')[1].click(); });
  expect(change).toHaveBeenCalledTimes(1);
  expect(host.querySelector('.rrSwitchDisabled')).not.toBeNull();
});
