import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { expect, test, vi } from 'vitest';
import { useLeftPanelActions } from '../../webview/src/components/leftPanel/useLeftPanelActions';
import { createDraftCommand, createDefaultRule } from '../../webview/src/utils';
import { getDict } from '../../webview/src/i18n';

test('删除未选中命令不改变选择；删除最后规则会补默认规则', () => {
  const host = document.createElement('div'); document.body.appendChild(host); let api: ReturnType<typeof useLeftPanelActions>;
  const rules = [{ engine: 'text', find: 'a', replace: 'b' }];
  let commands: any[] = [{ id: 'a', title: 'A', rules }, { id: 'b', title: 'B', rules }];
  const p: any = { commands, selectedIdRef: { current: undefined }, selectedId: 'a', selectedRuleIndex: 0, pendingAutoSelectIdRef: { current: undefined }, setCommands: (f: any) => { commands = f(commands); }, setSelectedRuleIndex: vi.fn(), setDirty: vi.fn(), scheduleAutoSaveAfterDelete: vi.fn(), createDraftCommand, createDefaultRule, t: getDict('en') };
  function Harness(): React.ReactElement { api = useLeftPanelActions(p); return <div />; }
  try {
    act(() => { ReactDOM.render(<Harness />, host); }); api!.onDeleteCommand('b'); expect(commands.map(c => c.id)).toEqual(['a']); expect(p.pendingAutoSelectIdRef.current).toBeUndefined();
    api!.onDeleteRule('a', 0); expect(commands[0].rules).toEqual([createDefaultRule()]);
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); }
});
