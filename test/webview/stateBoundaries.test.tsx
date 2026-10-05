import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { expect, test, vi } from 'vitest';
import { useRuleUiCache } from '../../webview/src/hooks/useRuleUiCache';
import { useCommandSelection } from '../../webview/src/features/app/commands/selection';
import { useMessageRouter } from '../../webview/src/features/app/messages/messageRouter';
import { useSnapshotReset, computeResetToSaved } from '../../webview/src/features/app/commands/draftAndSnapshot';
import { createDraftCommand, createDefaultRule } from '../../webview/src/utils';

function Harness({ run }: { run: () => void }): React.ReactElement { run(); return <div />; }

test('预填规则缓存保持所有临时状态、已有缓存不可被覆盖', () => {
  const host = document.createElement('div'); document.body.appendChild(host); let api: ReturnType<typeof useRuleUiCache>;
  const p = { isReady: false, selectedCmdId: undefined as string | undefined, selectedRuleUid: undefined as string | undefined, selectedRuleIndex: 0, getDefaultTestText: () => 'default', getDefaultReplaceTemplate: () => 'replace', onRestore: vi.fn() };
  const render = () => act(() => { ReactDOM.render(<Harness run={() => { api = useRuleUiCache(p); }} />, host); });
  try {
    render(); api!.primeRuleCache('a', 0, 'u1'); api!.primeRuleCache('a', 1, 'u2', { testText: 'Text', replaceTemplate: '$1', toolsTab: 'details', currentMatchIndex: 3, listScrollTop: 22, applyPreHooks: true, applyPostHooks: true, applyPrevRules: true }); api!.primeRuleCache('a', 1, 'u2', { testText: 'wrong' });
    p.isReady = true; p.selectedCmdId = 'a'; p.selectedRuleUid = 'u2'; render(); expect(api!.testText).toBe('Text'); expect(api!.toolsTab).toBe('details'); expect(api!.listScrollTop).toBe(22); expect(api!.applyPostHooks).toBe(true); expect(api!.applyPrevRules).toBe(true);
    p.selectedRuleUid = 'u1'; render(); expect(api!.testText).toBe(''); expect(api!.toolsTab).toBe('replace');
    p.selectedCmdId = undefined; p.selectedRuleUid = 'u3'; render(); expect(api!.testText).toBe('');
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); }
});

test('选择请求合并消费且卸载时取消延迟回调', () => {
  vi.useFakeTimers(); const host = document.createElement('div'); document.body.appendChild(host); let api: ReturnType<typeof useCommandSelection>;
  const p = { selectedId: 'a', setSelectedId: vi.fn(), setSelectedRuleIndex: vi.fn() };
  try {
    act(() => { ReactDOM.render(<Harness run={() => { api = useCommandSelection(p); }} />, host); });
    api!.requestAutoSelectCommand('b'); api!.requestAutoSelectCommand('c'); api!.requestAutoSelectRuleIndex(2);
    act(() => { vi.runAllTimers(); }); expect(p.setSelectedId).toHaveBeenLastCalledWith('c'); expect(p.setSelectedRuleIndex).toHaveBeenLastCalledWith(2);
    api!.requestAutoSelectCommand('d'); act(() => { ReactDOM.unmountComponentAtNode(host); }); act(() => { vi.runAllTimers(); }); expect(p.setSelectedId).not.toHaveBeenCalledWith('d');
  } finally { host.remove(); vi.useRealTimers(); }
});

test('消息路由忽略其他消息与无效数据', () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const p: any = { vscodeApi: { postMessage: vi.fn() }, getUntitledTitle: () => 'Untitled command', setCommands: vi.fn(), setSelectedId: vi.fn(), setSelectedRuleIndex: vi.fn(), setDirty: vi.fn(), commands: [], commandsRef: { current: [] }, selectedIdRef: { current: undefined }, savedSnapshotRef: { current: null }, pendingAutoSelectIdRef: { current: undefined }, pendingAutoSelectRuleIndexRef: { current: null }, pendingAutoSavePayloadRef: { current: null }, autoCreatedRef: { current: false }, initialUntitledEnsuredRef: { current: false }, draftIdRef: { current: undefined }, createDraftCommand, uiLocaleRef: { current: 'en' } };
  try {
    act(() => { ReactDOM.render(<Harness run={() => useMessageRouter(p)} />, host); });
    for (const data of [null, 2, 'config', { type: 'language' }]) act(() => { window.dispatchEvent(new MessageEvent('message', { data })); }); expect(p.setCommands).not.toHaveBeenCalled();
    const unsaved = { ...createDraftCommand('Untitled command'), rules: [{ engine: 'text', find: 'unsaved', replace: 'new' }] };
    p.commandsRef.current = [unsaved];
    const saved = { ...unsaved, id: 'saved-draft' };
    act(() => { window.dispatchEvent(new MessageEvent('message', { data: { type: 'config', payload: [saved] } })); });
    expect(p.setCommands.mock.lastCall[0].map((c: any) => c.id)).toEqual([unsaved.id, saved.id]);
    act(() => { window.dispatchEvent(new MessageEvent('message', { data: { type: 'config', payload: [{ ...saved, title: 'Named' }] } })); });
    expect(p.setCommands.mock.lastCall[0][0].rules[0].find).toBe('unsaved');

  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); }
});

test('空快照重置不写状态；已有命名命令不会被补成同 ID 草稿', () => {
  const saved: any = { id: 'a', title: 'A', rules: [{ engine: 'text', find: 'a', replace: 'b' }] };
  const draft = createDraftCommand('Untitled command');
  const res = computeResetToSaved({ snapshot: [saved], currentCommands: [draft, saved], prevSelectedId: 'a', prevSelectedRuleIndex: 0, untitledTitle: 'Untitled command', createDraftCommand, createDefaultRule });
  expect(res.nextCommands.filter(c => c.id === 'a')).toEqual([saved]); expect(res.nextSelectedId).toBe('a');
  const empty = computeResetToSaved({ snapshot: [], currentCommands: [], prevSelectedId: undefined, prevSelectedRuleIndex: 0, untitledTitle: '', createDraftCommand, createDefaultRule }); expect(empty.nextSelectedId).toBeUndefined();
  const host = document.createElement('div'); document.body.appendChild(host); let api: ReturnType<typeof useSnapshotReset>; const setCommands = vi.fn();
  const p: any = { savedSnapshotRef: { current: null }, commandsRef: { current: [] }, selectedIdRef: { current: undefined }, setCommands };
  try { act(() => { ReactDOM.render(<Harness run={() => { api = useSnapshotReset(p); }} />, host); }); api!.requestResetToSaved(); p.savedSnapshotRef.current = []; api!.requestResetToSaved(); expect(setCommands).not.toHaveBeenCalled(); }
  finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); }
});
