import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { expect, test, vi } from 'vitest';
import { LeftPanel, type LeftPanelProps } from '../../webview/src/components/LeftPanel';

let contexts: any[] = [];
let dragging = false;
vi.mock('@dnd-kit/core', () => ({ DndContext: (p: any) => { contexts.push(p); return <div>{p.children}</div>; }, PointerSensor: class {}, closestCenter: vi.fn(), useSensor: vi.fn(), useSensors: () => [] }));
vi.mock('@dnd-kit/sortable', async () => ({ ...await vi.importActual<any>('@dnd-kit/sortable'), SortableContext: (p: any) => <div>{p.children}</div>, useSortable: () => ({ setNodeRef: vi.fn(), attributes: {}, listeners: {}, transform: null, isDragging: dragging }) }));

const strings = { searchPlaceholder: 'Search', commandListTitle: '{n}', newCommand: 'New', export: 'Export', import: 'Import', ruleLabel: 'Rule', enabled: 'Enabled', disabled: 'Disabled', renameCommand: 'Rename', deleteCommand: 'Delete', deleteRule: 'Delete rule', confirmDeleteCommand: 'Confirm', confirmDeleteRule: 'Confirm rule' };

test('命令与规则的排序、搜索及删除确认保持独立', async () => {
  const commands: any[] = [{ id: 'a', title: 'A', rules: [{ engine: 'text', find: 'a', replace: 'b', title: 'named', enable: false }, { engine: 'text', find: '', replace: '' }] }, { id: 'b', title: 'B', rules: [{ enable: false }] }, { id: 'draft', title: 'draft', rules: [] }];
  const p: LeftPanelProps = { leftWidth: 200, t: strings, commands, filtered: commands, search: '', selectedId: 'a', selectedRuleIndex: 0, isUntitledCommandTitle: v => v === 'draft', isCommandDeletable: c => c.id !== 'draft', isCommandDirty: c => c.id === 'a', isRuleDirty: (_, i) => i === 0, onChangeSearch: vi.fn(), onClickExport: vi.fn(), onClickImport: vi.fn(), onClickNewCommand: vi.fn(), isNewCommandDisabled: false, onSelectCommand: vi.fn(), onSelectRule: vi.fn(), onRenameCommand: vi.fn(), onReorderCommands: vi.fn(), onDeleteCommand: vi.fn(), onDeleteRule: vi.fn(), onConfirm: vi.fn().mockResolvedValue(false), getRuleUids: () => ['u1', 'u2'], onReorderRules: vi.fn() };
  const host = document.createElement('div'); document.body.appendChild(host);
  let renderId = 0;
  const render = () => act(() => { contexts = []; ReactDOM.render(<LeftPanel key={++renderId} {...p} />, host); });
  const click = (s: string) => act(() => { host.querySelector<HTMLElement>(s)!.click(); });
  const invalid = [{}, { active: { id: 'u1' } }, { active: { id: 'u1' }, over: { id: 'u1' } }, { active: { id: 'missing' }, over: { id: 'u2' } }, { active: { id: 'u1' }, over: { id: 'missing' } }];
  try {
    for (const isDragging of [false, true]) {
      dragging = isDragging; render();
      const handles = host.querySelectorAll<HTMLElement>('[aria-label="拖拽排序"]');
      for (const h of handles) act(() => { Simulate.mouseDown(h); Simulate.click(h); });
      click('.commandTitle'); click('[aria-label="Rename command"]'); click('[aria-label="Delete command"]'); click('.rrRuleItem');
      const [cmd, rules] = contexts;
      for (const e of invalid) { act(() => { cmd.onDragEnd(e); }); act(() => { rules.onDragEnd(e); }); }
      act(() => { cmd.onDragEnd({ active: { id: 'a' }, over: { id: 'b' } }); });
      act(() => { rules.onDragEnd({ active: { id: 'u1' }, over: { id: 'u2' } }); });
    }
    expect(p.onRenameCommand).toHaveBeenCalledWith('a', 'A');
    expect(p.onReorderCommands).toHaveBeenCalledWith(['b', 'a', 'draft']);
    expect(p.onReorderRules).toHaveBeenCalledWith('a', ['u2', 'u1']);
    await act(async () => { host.querySelector<HTMLElement>('[aria-label="Delete rule"]')!.click(); });
    expect(p.onDeleteRule).not.toHaveBeenCalled();
    vi.mocked(p.onConfirm).mockResolvedValue(true);
    await act(async () => { host.querySelector<HTMLElement>('[aria-label="Delete rule"]')!.click(); });
    expect(p.onDeleteRule).toHaveBeenCalledWith('a', 0);
    p.search = 'A'; p.filtered = commands.slice(0, 1); render();
    click('[aria-label="Rename command"]'); click('[aria-label="Delete command"]'); click('.rrRuleItem');
    const rules = contexts[0];
    for (const e of invalid) act(() => { rules.onDragEnd(e); });
    act(() => { rules.onDragEnd({ active: { id: 'u1' }, over: { id: 'u2' } }); });
    await act(async () => { host.querySelector<HTMLElement>('[aria-label="Delete rule"]')!.click(); });
    act(() => { Simulate.change(host.querySelector('input')!, { target: { value: 'query' } } as any); });
    expect(p.onChangeSearch).toHaveBeenCalledWith('query');
    p.getRuleUids = () => ['u1']; render(); expect(host.querySelector('.rrRuleItem')).toBeNull();
    p.search = ''; p.filtered = commands; render(); expect(host.querySelector('.rrRuleItem')).toBeNull();
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); dragging = false; }
});

