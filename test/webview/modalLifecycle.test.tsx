import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { expect, test, vi } from 'vitest';
import { ConfirmModal } from '../../webview/src/components/base/ConfirmModal';
import { RenameCommandModal } from '../../webview/src/components/RenameCommandModal';
import { HookDependencyConfirmModal } from '../../webview/src/components/base/HookDependencyConfirmModal';
let data: any = {};
let defaults: any;
let events: any;
let visible = true;
const end = vi.fn(); const cancel = vi.fn();
vi.mock('use-modal-ref', () => ({ default: (_: any, d: any, e: any) => { defaults = d; events = e; return { modal: { visible, endModal: end, cancelModal: cancel }, data: { ...d, ...data } }; } }));

test('弹窗确认、取消以及重命名的打开关闭状态清理', () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const render = (el: React.ReactElement) => act(() => { ReactDOM.render(el, host); });
  const click = (label: string) => act(() => { [...host.querySelectorAll('button')].find(b => b.textContent === label)!.click(); });
  try {
    data = {}; render(<ConfirmModal />); click('取消'); click('确定');
    expect(cancel).toHaveBeenCalled(); expect(end).toHaveBeenCalledWith(true);
    render(<RenameCommandModal />);
    expect(defaults.validateName('anything')).toBeUndefined();
    act(() => { events.beforeModal({ initialValue: ' Existing ' }); });
    expect(host.querySelector('input')?.value).toBe(' Existing ');
    act(() => { Simulate.keyDown(host.querySelector('input')!, { key: 'Enter' }); });
    expect(end).toHaveBeenCalledWith('Existing');
    act(() => { events.afterCloseModal(); }); expect(host.querySelector('input')?.value).toBe('');
    data = { validateName: undefined }; render(<RenameCommandModal />);
    act(() => { events.beforeModal({}); }); click('确定'); expect(end).toHaveBeenCalledWith('');
    data = { referrerBlocks: [{ commandId: 'c', commandTitle: 'Caller', items: ['pre', 'post'] }] }; render(<HookDependencyConfirmModal />);
    expect(host.textContent).toContain('Caller'); expect(host.textContent).toContain('post');
    click('取消'); expect(end).toHaveBeenLastCalledWith({ ok: false, removeFromOthers: false, referrerEntriesToStrip: [] });
    data = { referrerRows: undefined, referrerBlocks: undefined, danger: false }; render(<HookDependencyConfirmModal />); click('确定');
    expect(end).toHaveBeenLastCalledWith({ ok: true, removeFromOthers: false, referrerEntriesToStrip: [] });
    const entry = { sourceCommandId: 'c', sourceTitle: '', ruleIndex: 0, phase: 'pre' };
    data = { showRemoveFromOthersCheckbox: true, referrerRows: [{ key: 'a', label: 'A', entry }, { key: 'b', label: 'B', entry }] }; render(<HookDependencyConfirmModal />);
    expect(host.querySelector('.rrHookDepConfirm__blockTitle')?.textContent).toContain('c');
    click('确定'); expect(end.mock.lastCall?.[0].referrerEntriesToStrip).toHaveLength(2);
    act(() => { Simulate.change(host.querySelector('[data-rr-hook-dep-master]')!, { target: { checked: false } } as any); });
    click('确定'); expect(end.mock.lastCall?.[0].referrerEntriesToStrip).toEqual([]);
    visible = false; render(<HookDependencyConfirmModal />); expect(host.textContent).toBe('');
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); visible = true; }
});
