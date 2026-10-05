import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { expect, test, vi } from 'vitest';
import { MappingTable, type MappingTableProps } from '../../webview/src/components/MappingTable';
import { I18nProvider } from '../../webview/src/i18n/I18nProvider';
// 隔离子编辑器的实现，验证映射表如何接收编辑、失焦与修改完成事件。
vi.mock('../../webview/src/components/RegexExpressionEditor', () => ({ RegexExpressionEditor: (p: any) => <input className="regexStub" value={p.value} onChange={e => p.onChange(e.target.value)} onBlur={p.onBlur} onKeyUp={p.onAfterChange} /> }));
vi.mock('../../webview/src/components/ReplacementTemplateField', () => ({ ReplacementTemplateField: (p: any) => <input className="replaceStub" value={p.value} onChange={e => p.onChange(e.target.value)} /> }));

test('空值失焦提示可恢复，映射优先级可移动，悬浮工具保持与关闭', async () => {
  vi.useFakeTimers();
  const host = document.createElement('div'); document.body.appendChild(host);
  const change = vi.fn();
  const p: MappingTableProps = { map: undefined, onChangeMap: change, uiLanguage: 'en', t: { title: 'Map', colMatch: 'Match', colReplace: 'Replace', addRow: 'Add', deleteRow: 'Delete', duplicateKey: 'Duplicate', matchHelp: 'Help' } };
  const render = () => act(() => { ReactDOM.render(<I18nProvider><MappingTable {...p} /></I18nProvider>, host); });
  const edit = (el: Element, value: string) => act(() => { Simulate.change(el, { target: { value } } as any); });
  try {
    render();
    let inputs = host.querySelectorAll('.rrInput__control');
    act(() => { Simulate.blur(inputs[0]); }); expect(host.querySelector('.rrInput--status-error')).not.toBeNull();
    edit(inputs[1], 'replacement'); expect(host.querySelector('.rrInput--status-error')).not.toBeNull();
    edit(inputs[0], 'a'); expect(host.querySelector('.rrInput--status-error')).toBeNull();
    act(() => { Simulate.blur(inputs[0]); });
    act(() => { host.querySelector<HTMLButtonElement>('[aria-label="Add"]')!.click(); });
    inputs = host.querySelectorAll('.rrInput__control'); edit(inputs[2], 'b');
    let row = host.querySelector('.rrMappingTableRow')!;
    act(() => { Simulate.mouseEnter(row); });
    const down = document.querySelector<HTMLButtonElement>('[aria-label="下移当前条目"]')!;
    expect(down.disabled).toBe(false); act(() => { down.click(); });
    expect(change.mock.lastCall?.[0].cases.map((c: any) => c.find)).toEqual(['b', 'a']);
    act(() => { document.querySelector<HTMLButtonElement>('[aria-label="上移当前条目"]')!.click(); });
    expect(change.mock.lastCall?.[0].cases.map((c: any) => c.find)).toEqual(['a', 'b']);
    row = host.querySelector('.rrMappingTableRow')!;
    act(() => { Simulate.mouseLeave(row); });
    const floats = [...document.querySelectorAll('.rrMappingTableFloatInner')];
    for (const f of floats) act(() => { Simulate.mouseEnter(f); });
    act(() => { vi.advanceTimersByTime(150); }); expect(document.querySelector('.rrMappingTableDelBtn')).not.toBeNull();
    for (const f of floats) act(() => { Simulate.mouseLeave(f); });
    act(() => { Simulate.mouseEnter(row); }); act(() => { Simulate.mouseLeave(row); }); act(() => { vi.advanceTimersByTime(150); });
    expect(document.querySelector('.rrMappingTableDelBtn')).toBeNull();
    // 重复键、已有有效行旁的空行，以及删除唯一空行后的恢复。
    inputs = host.querySelectorAll('.rrInput__control'); edit(inputs[2], 'a'); act(() => { Simulate.blur(inputs[2]); });
    expect(document.body.textContent).toContain('Duplicate'); expect(host.querySelectorAll('.rrInput--status-error')).toHaveLength(2);
    edit(inputs[2], ''); act(() => { Simulate.blur(inputs[2]); }); expect(host.querySelector('.rrInput--status-error')).not.toBeNull();
    edit(inputs[2], 'b'); expect(host.querySelector('.rrInput--status-error')).toBeNull();
    p.map = change.mock.lastCall?.[0]; render();
    act(() => { Simulate.mouseEnter(host.querySelector('.rrMappingTableRow')!); });
    const lateDelete = document.querySelector<HTMLButtonElement>('.rrMappingTableDelBtn')!;
    act(() => { Simulate.click(lateDelete); Simulate.click(lateDelete); }); expect(change.mock.lastCall?.[0].cases).toEqual([]);
    expect(host.querySelectorAll('.rrMappingTableRow')).toHaveLength(1);
    p.map = { mode: 'regex', cases: [{ find: '(a)', replace: '$1' }, { find: 'b', replace: 'B' }] }; render();
    const expr = host.querySelector('.regexStub')!; edit(expr, '(c)'); act(() => { Simulate.keyUp(expr); }); act(() => { Simulate.blur(expr); });
    edit(host.querySelector('.replaceStub')!, '$2'); expect(change.mock.lastCall?.[0].cases[0]).toEqual({ find: '(c)', replace: '$2' });
    act(() => { Simulate.change(host.querySelector('[type="checkbox"]')!, { target: { checked: false } } as any); }); expect(change.mock.lastCall?.[0].mode).toBe('text');
    // 父层接收写回后，外部切换命令应重新同步。
    p.map = change.mock.lastCall?.[0]; render();
    p.map = { mode: 'text', cases: [{ find: '', replace: '' }] }; p.uiLanguage = 'zh-CN'; render();
    act(() => { Simulate.blur(host.querySelector('.rrInput__control')!); });
    expect(document.body.textContent).toContain('不能为空');
    p.map = { mode: 'regex', cases: [{ find: null as any, replace: undefined as any }, { find: 'b', replace: '' }] }; render();
    act(() => { Simulate.blur(host.querySelector('.regexStub')!); });
    expect(host.querySelector('.rrMappingTableExprHost--error')).not.toBeNull();
    act(() => { Simulate.mouseEnter(host.querySelector('.rrMappingTableRow')!); }); act(() => { Simulate.mouseLeave(host.querySelector('.rrMappingTableRow')!); });
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); vi.useRealTimers(); }
});
