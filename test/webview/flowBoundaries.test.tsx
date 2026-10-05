import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { expect, test, vi } from 'vitest';
import * as utils from '../../webview/src/utils';
import * as refs from '../../webview/src/features/hooks/hookReferrers';
import * as hooks from '../../webview/src/features/hooks/hookUtils';
import { useAppModals } from '../../webview/src/features/app/modals/modals';
import { useSaveFlow, validateMapRulesBeforeSave, validateRuleExpressionsBeforeSave, validateNamesBeforeSave } from '../../webview/src/features/app/save/saveFlow';
import { findFirstUntitledCommand, isSavableRule, validateRuleTitle } from '../../webview/src/features/commands/saveUtils';

function Harness({ run }: { run: () => void }): React.ReactElement { run(); return <div />; }

test('导入容错、本地化回退、草稿判定与文本高度合并更新', () => {
  for (const [value, locale, expected] of [[null, 'en', ''], [3, 'en', ''], [{ en: '', 'zh-CN': '中文' }, 'en', '中文'], [{ fr: 2, de: ' Text ' }, 'zh-CN', 'Text'], [{ fr: 2, en: false }, 'en', '']] as const) expect(utils.pickLocalizedString(value, locale)).toBe(expected);
  const list = utils.sanitizeCommandsPayload([null, 3, {}, { title: '中文', rules: 'bad' }, { id: 'same', title: 'A', description: 'D', rules: [null, 3, { engine: 'text', title: 'Name', find: 'a', replace: 'b', enable: false, testText: 'T', preCommands: ['a', 3], postCommands: ['b', false], wildcardOptions: { dotAll: true } }, { engine: 'wildcard', name: 'Alias', enable: true, wildcardOptions: { dotAll: 'bad' } }, { engine: 'bad', find: 3, replace: 5, flags: null, title: null }] }, { id: 'same', title: 'A (2)' }, { title: 'A' }]);
  expect(list.map(c => c.title)).toEqual(['中文', 'A', 'A (2)', 'A (3)']);
  expect(new Set(list.map(c => c.id)).size).toBe(4);
  expect(list[1].rules[0]).toMatchObject({ engine: 'text', title: 'Name', enable: false, testText: 'T', preCommands: ['a'], postCommands: ['b'], wildcardOptions: { dotAll: true } });
  expect(list[1].rules[2]).toEqual({ engine: 'regex', find: '', replace: '', flags: 'g' });
  expect(utils.sanitizeCommandsPayload({})).toEqual([]);
  const draft = { title: '未命名命令', rules: [{}] };
  expect(utils.isPristineUntitledDraft(draft)).toBe(true);
  for (const patch of [{ description: 'D' }, { preCommands: ['a'] }, { postCommands: ['a'] }, { rules: undefined }, { rules: [] }, { rules: [{ preCommands: ['a'] }] }, { rules: [{ postCommands: ['a'] }] }, { rules: [{ find: 'a' }] }, { rules: [{ replace: 'a' }] }]) expect(utils.isPristineUntitledDraft({ ...draft, ...patch })).toBe(false);
  expect(utils.hasAnyCapturingGroup('(a)')).toBe(true); expect(utils.hasAnyCapturingGroup(undefined as any)).toBe(false);
  const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 23); const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  const textarea = document.createElement('textarea'); Object.defineProperty(textarea, 'scrollHeight', { value: 42 });
  utils.autoResizeTextarea(textarea); utils.autoResizeTextarea(textarea); expect(cancel).toHaveBeenCalledWith(23);
  frame.mock.calls[1][0](0); expect(textarea.style.height).toBe('42px'); frame.mockRestore(); cancel.mockRestore();
});

test('依赖收集兼容缺失规则、前后置分组与定向移除', () => {
  const commands: any[] = [{ id: 'a', rules: [{ title: 'Named', preCommands: ['target', 'keep'], postCommands: ['target'] }, {}] }, { id: 'b', title: 'B' }];
  expect(refs.collectHookReferrerEntries(commands, '')).toEqual([]);
  const entries = refs.collectHookReferrerEntries(commands, 'target'); expect(entries).toHaveLength(2);
  const rows = refs.buildHookReferrerRows(entries, n => `Rule ${n}`, 'Pre', 'Post'); expect(rows.map(r => r.label).join(' ')).toContain('Post');
  const blocks = refs.groupHookReferrerEntriesForModal(entries, n => `Rule ${n}`, 'Pre', 'Post'); expect(blocks[0].commandTitle).toBe('a'); expect(blocks[0].items).toHaveLength(2);
  expect(refs.stripHookIdFromCommands(commands, '')).toBe(commands); expect(refs.stripHookIdFromCommands(commands, 'target')[1].rules).toEqual([]);
  expect(refs.stripHookIdFromReferrerEntries(commands, '', entries)).toBe(commands); expect(refs.stripHookIdFromReferrerEntries(commands, 'target', [])).toBe(commands);
  const stripped = refs.stripHookIdFromReferrerEntries(commands, 'target', [...entries, { ...entries[0], ruleIndex: 99 }]); expect(stripped[0].rules[0]).toMatchObject({ preCommands: ['keep'], postCommands: [] }); expect(stripped[1]).toBe(commands[1]);
  expect(hooks.getSelectedRuleHooks({ id: 'a', title: '' }, 0, 'post')).toEqual([]);
  expect(hooks.wouldCreateLoop([{ id: 'a', title: '' }, { id: 'b', title: '', rules: [{ postCommands: ['b', 'missing'] }] }], 'a', 'b')).toBe(false);
  expect(hooks.wouldCreateLoop([], '', 'a')).toBe(false); expect(hooks.wouldCreateLoop([], 'a', '')).toBe(false); expect(hooks.wouldCreateLoop([], 'a', 'unknown')).toBe(false);
  expect(hooks.getHookOptions([{ id: 'a', title: 'A' }], '')[0].disabled).toBe(false);
  expect(findFirstUntitledCommand([{ title: 'Untitled command' }])?.title).toBe('Untitled command');
  expect(isSavableRule({ find: undefined as any, postCommands: ['a'] })).toBe(true); expect(validateRuleTitle(undefined as any, 'bad')).toBeUndefined();
});

test('保存校验覆盖映射数据缺失、正则模式与语言提示', () => {
  const toast = { show: vi.fn() }; const t = { nameRequired: 'required', nameDuplicate: 'duplicate', nameReservedChars: 'reserved', ruleTitleReservedChars: 'title reserved', ruleLabel: 'Rule', addRuleFirst: 'add', confirm: '', cancel: '' };
  const deps: any = { lang: 'en', t, toast };
  const command = (rule: any) => [{ id: 'a', title: 'A', rules: [rule] }] as any;
  for (const map of [undefined, { cases: {} }, { cases: [] }, { cases: [null] }, { cases: [{ find: ' ' }] }, { mode: 'regex', cases: [{ find: '[' }] }]) expect(validateMapRulesBeforeSave(command({ engine: 'regex', replaceMode: 'map', map }), deps)).toBe(false);
  expect(toast.show.mock.calls.map(c => c[0]).join(' ')).toContain('non-empty');
  deps.lang = 'zh-CN'; expect(validateMapRulesBeforeSave(command({ engine: 'regex', replaceMode: 'map', map: { cases: [{}] } }), deps)).toBe(false);
  expect(validateMapRulesBeforeSave(command({ engine: 'regex', replaceMode: 'map', map: { mode: 'regex', cases: [{ find: '(a)' }] } }), deps)).toBe(true);
  expect(validateRuleExpressionsBeforeSave(command({ engine: 'regex' }), deps)).toBe(true);
  deps.lang = 'en'; expect(validateRuleExpressionsBeforeSave(command({ engine: 'regex', find: '[', title: 'Named' }), deps)).toBe(false); expect(toast.show.mock.lastCall?.[0]).toContain('Named');
  expect(validateNamesBeforeSave([{ rules: [] }] as any, deps)).toBe(false);
  expect(validateNamesBeforeSave([{ id: 'a', title: 'A' }] as any, deps)).toBe(true);
  for (const lang of ['en', 'zh-CN']) { deps.lang = lang; expect(validateNamesBeforeSave(command({ title: '[bad]' }), deps)).toBe(false); }
});

test('依赖确认取消、无选中、已禁用及卸载后的保存边界', async () => {
  vi.useFakeTimers(); const host = document.createElement('div'); document.body.appendChild(host);
  let api: ReturnType<typeof useAppModals>;
  const p: any = { lang: 'en', t: { ruleLabel: 'Rule', cancel: 'cancel', confirm: 'ok', untitledCommand: 'Untitled command', hookDepPhasePre: 'Pre', hookDepPhasePost: 'Post', hookDepIntroDisableSimple: 'Disable', hookDepIntroDisableDepsHint: 'Deps' }, commandsRef: { current: [] }, selectedIdRef: { current: undefined }, selectedRuleIndex: 0, pendingAutoSelectIdRef: { current: undefined }, setCommands: (f: any) => { p.commandsRef.current = f(p.commandsRef.current); }, setDirty: vi.fn(), setSelectedRuleIndex: vi.fn(), scheduleAutoSaveAfterDelete: vi.fn(), requestSaveFrom: vi.fn(), isMountedRef: { current: true }, modalApi: { showHookDepModal: vi.fn().mockResolvedValue({ ok: false }) }, toast: { show: vi.fn() } };
  const render = () => act(() => { ReactDOM.render(<Harness run={() => { api = useAppModals(p); }} />, host); });
  try {
    render(); await api!.confirmDisableCurrentRule(); await api!.requestRuleEnableButtonClick(vi.fn()); await api!.confirmDeleteCommandWithDeps('a'); expect(p.setDirty).not.toHaveBeenCalled();
    p.modalApi.showHookDepModal.mockRejectedValue(new Error('cancel')); await api!.confirmDeleteCommandWithDeps('a');
    p.commandsRef.current = [{ id: 'a', title: 'A', rules: [{ enable: false }] }]; p.selectedIdRef.current = 'a'; render();
    const enable = vi.fn(); await api!.requestRuleEnableButtonClick(enable); expect(enable).toHaveBeenCalledWith(true);
    await api!.confirmDisableCurrentRule(); expect(p.setDirty).not.toHaveBeenCalled();
    p.modalApi.showHookDepModal.mockResolvedValue({ ok: false }); await api!.confirmDisableCurrentRule(); expect(p.setDirty).not.toHaveBeenCalled();
    p.modalApi.showHookDepModal.mockResolvedValue({ ok: true, removeFromOthers: true }); await api!.confirmDisableCurrentRule();
    p.isMountedRef.current = false; act(() => { vi.runAllTimers(); }); expect(p.requestSaveFrom).not.toHaveBeenCalled();
    p.selectedRuleIndex = -1; render(); await api!.confirmDisableCurrentRule(); p.selectedRuleIndex = 5; render(); await api!.requestRuleEnableButtonClick(enable);
    p.selectedIdRef.current = undefined; p.modalApi.showHookDepModal.mockResolvedValue({ ok: true }); await api!.confirmDeleteCommandWithDeps('missing'); expect(p.commandsRef.current).toHaveLength(1);
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); vi.useRealTimers(); }
});

test('保存操作验证全部名称、无选择和当前空规则', () => {
  const host = document.createElement('div'); document.body.appendChild(host); let api: ReturnType<typeof useSaveFlow>;
  const p: any = { lang: 'en', t: { nameRequired: 'required', nameDuplicate: 'duplicate', nameReservedChars: 'reserved', ruleTitleReservedChars: 'reserved', ruleLabel: 'Rule', addRuleFirst: 'add' }, toast: { show: vi.fn() }, commands: [], commandsRef: { current: [] }, savedSnapshotRef: { current: null }, selectedIdRef: { current: undefined }, selectedRuleIndex: 0, setSelectedRuleIndex: vi.fn(), setCommands: vi.fn(), setDirty: vi.fn(), vscodeApi: { postMessage: vi.fn() }, openRenameCommand: vi.fn() };
  const render = () => act(() => { ReactDOM.render(<Harness run={() => { api = useSaveFlow(p); }} />, host); });
  const good: any = { id: 'a', title: 'A', rules: [{ engine: 'text', find: 'a', replace: 'b' }] };
  try {
    render(); api!.requestSaveFrom([good]); expect(p.vscodeApi.postMessage).toHaveBeenCalled();
    p.selectedIdRef.current = 'a'; api!.requestSaveFrom([good, { ...good, id: 'bad', title: '[bad]' }], { validateAllCommandNames: true }); expect(p.toast.show).toHaveBeenLastCalledWith('reserved', 'error');
    p.selectedRuleIndex = 99; render(); api!.doSaveFrom([good]); expect(p.toast.show).toHaveBeenLastCalledWith('add', 'info');
    api!.doSaveFrom([{ ...good, rules: [{ engine: 'text', find: 'a', replaceMode: 'map' }] }]); expect(p.toast.show.mock.lastCall?.[1]).toBe('error');
    api!.doSaveFrom([{ ...good, rules: [{ engine: 'regex', find: '[' }] }]); expect(p.toast.show.mock.lastCall?.[1]).toBe('error');
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); }
});
