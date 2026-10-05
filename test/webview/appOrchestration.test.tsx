import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { expect, test, vi } from 'vitest';
import { App } from '../../webview/src/App';
import { I18nProvider } from '../../webview/src/i18n/I18nProvider';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
const state = vi.hoisted(() => ({ showArrow: true, p: {} as Record<string, any>, menus: {} as Record<string, any>, chips: [] as any[], splits: [] as any[], post: vi.fn(), modal: vi.fn(), copy: vi.fn().mockResolvedValue(true), buttons: {} as Record<string, any>, checks: {} as Record<string, any> }));
vi.mock('../../webview/src/bridge/vscodeApi', () => ({ createVscodeApi: () => ({ postMessage: state.post, getState: () => ({ showSplitterToggleArrow: state.showArrow }), setState: vi.fn() }) }));
vi.mock('use-modal-ref', () => ({ showRefModal: (...args: any[]) => state.modal(...args) }));
vi.mock('../../webview/src/utils/clipboard', () => ({ copyTextToClipboard: (...args: any[]) => state.copy(...args) }));
vi.mock('../../webview/src/features/app/messages/messageRouter', async () => { const actual = await vi.importActual<any>('../../webview/src/features/app/messages/messageRouter'); return { useMessageRouter: (p: any) => { state.p.router = p; actual.useMessageRouter(p); } }; });
vi.mock('../../webview/src/components/LeftPanel', () => ({ LeftPanel: (p: any) => { state.p.left = p; return <div />; } }));
vi.mock('../../webview/src/components/RuleExpressionField', () => ({ RuleExpressionField: (p: any) => { state.p.expr = p; return <div />; } }));
vi.mock('../../webview/src/components/RuleTitleEditor', () => ({ RuleTitleEditor: (p: any) => { state.p.title = p; return <div />; } }));
vi.mock('../../webview/src/components/CodeMirrorTextEditor', () => ({ CodeMirrorTextEditor: (p: any) => { state.p.text = p; return <div />; } }));
vi.mock('../../webview/src/components/ReplacementTemplateField', () => ({ ReplacementTemplateField: (p: any) => { state.p.replace = p; return <div />; } }));
vi.mock('../../webview/src/components/MappingTable', () => ({ MappingTable: (p: any) => { state.p.map = p; return <div />; } }));
vi.mock('../../webview/src/components/HookChipsBar', () => ({ HookChipsBar: (p: any) => { state.chips.push(p); return <div />; } }));
vi.mock('../../webview/src/components/ReplaceResultBox', () => ({ ReplaceResultBox: (p: any) => { state.p.result = p; return <div />; } }));
vi.mock('../../webview/src/components/ListResultPanel', () => ({ ListResultPanel: (p: any) => { state.p.list = p; return <div />; } }));
vi.mock('../../webview/src/components/base', async () => {
  const actual = await vi.importActual<any>('../../webview/src/components/base');
  return { ...actual, Button: (p: any) => { state.buttons[p['aria-label']] = p; return <actual.Button {...p} />; }, Checkbox: (p: any) => { state.checks[p.ariaLabel] = p; return <actual.Checkbox {...p} />; }, DropdownMenu: (p: any) => { state.menus[p.name || p.buttonLabel] = p; return <div />; }, Switch: (p: any) => { state.p.switch = p; return <div />; }, TabBar: (p: any) => { state.p.tabs = p; return <div>{p.extra}</div>; }, Splitter: (p: any) => { state.splits.push(p); return <actual.Splitter {...p} />; } };
});

test('App 接收缺省字段、规则移除期间的延迟输入与真实光标匹配', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); localStorage.setItem('regexpReplacer.uiLanguage', 'en');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  state.p = {}; state.menus = {}; state.chips = []; state.buttons = {}; state.post.mockClear();
  state.modal.mockResolvedValue({ ok: true, removeFromOthers: false, referrerEntriesToStrip: [] });
  const host = document.createElement('div'); const editorHost = document.createElement('div'); document.body.append(host, editorHost);
  let editor: EditorView | undefined;
  const flush = async () => { await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(250); await Promise.resolve(); }); };
  const call = async (f: () => void) => { act(() => { f(); }); await flush(); };
  const command = { id: 'a', title: 'A', rules: [{ engine: 'regex', find: '(a)', replace: '', flags: 'g', testText: 'aaa' }] };
  try {
    act(() => { ReactDOM.render(<I18nProvider><App /></I18nProvider>, host); }); await flush();
    await call(() => state.p.router.setCommands([command])); await call(() => state.p.left.onSelectCommand('a'));
    await call(() => state.p.text.onChange('aaa'));
    editor = new EditorView({ state: EditorState.create({ doc: 'aaa', extensions: state.p.text.extensions }), parent: editorHost });
    await call(() => state.p.text.onEditorReady(editor));
    await call(() => { editor!.dispatch({ selection: { anchor: 1 } }); });
    await call(() => state.p.tabs.onChange('details')); expect(host.textContent).toContain('Group 1');
    await call(() => state.p.tabs.onChange('replace'));
    await call(() => state.p.router.setCommands([{ ...command, rules: [{ engine: 'regex', find: undefined, replace: undefined } as any] }]));
    await call(() => state.p.tabs.onChange('details')); await call(() => state.p.tabs.onChange('explain'));
    await call(() => state.p.expr.onToggleFlag('s')); expect(state.p.left.commands[0].rules[0].flags).toContain('s');
    await call(() => state.p.tabs.onChange('details')); await call(() => state.p.tabs.onChange('explain'));
    await call(() => state.p.title.onCommit(undefined));
    const enabled = state.buttons['Enabled']; const lateFlag = state.p.expr.onToggleFlag;
    await call(() => state.p.left.onSelectRule(99)); await call(() => lateFlag('i'));
    for (const menu of Object.values(state.menus).filter((p: any) => !p.name && p.options)) await call(() => menu.onToggle('other'));
    for (const chip of state.chips.slice(-2)) { await call(() => chip.onRemove('other')); await call(() => chip.onReorder([])); }
    expect(state.p.left.commands[0].rules).toHaveLength(1);
    const lateMenus = Object.values(state.menus).filter((p: any) => !p.name && p.options); const lateChips = state.chips.slice(-2);
    await call(() => state.p.router.setCommands([{ ...command, rules: [] }]));
    for (const menu of lateMenus) await call(() => menu.onToggle('other'));
    for (const chip of lateChips) { await call(() => chip.onRemove('other')); await call(() => chip.onReorder([])); }
    expect(state.p.left.commands[0].rules).toEqual([]);
    await call(() => state.p.router.setCommands([{ ...command, rules: [{ engine: 'regex', find: '[', replace: '', replaceMode: 'map', map: { mode: 'text', cases: [] } }] }]));
    await call(() => state.p.router.setSelectedId(undefined));
    await call(() => state.p.router.setSelectedId('a'));


    await call(() => state.p.left.onSelectRule(0));
    await call(() => state.p.router.setCommands([{ ...command, rules: [{ engine: 'text', find: 'a', replace: '', enable: false }] }]));
    await call(() => state.p.expr.onToggleFlag('i')); expect(state.p.left.commands[0].rules[0].flags).toBeUndefined();
    // 重新启用的自动保存任务在页面卸载后应失效。
    const postCount = state.post.mock.calls.filter(c => c[0].type === 'setConfig').length;
    act(() => { state.buttons['Disabled'].onClick(); });
    await act(async () => { await Promise.resolve(); });
    act(() => { ReactDOM.unmountComponentAtNode(host); }); await flush();
    expect(state.post.mock.calls.filter(c => c[0].type === 'setConfig')).toHaveLength(postCount);
    expect(enabled).toBeTruthy();
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); editor?.destroy(); host.remove(); editorHost.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); }
});

/** 在子组件边界驱动 App 的编排，断言实际状态与发给宿主的配置。 */
test('App 编排：hook 增删排序、引擎与映射切换、保存重置和工具输出', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  localStorage.setItem('regexpReplacer.uiLanguage', 'en'); localStorage.setItem('regexpReplacer.splitterToggleArrowVisible', '1');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  state.post.mockClear(); state.modal.mockResolvedValue({ ok: true, removeFromOthers: false, referrerEntriesToStrip: [] });
  const host = document.createElement('div'); document.body.appendChild(host);
  const flush = async () => { await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(250); await Promise.resolve(); }); };
  const call = async (f: () => void) => { act(() => { f(); }); await flush(); };
  const cmd = (id: string, rule: any = {}) => ({ id, title: id.toUpperCase(), rules: [{ engine: 'regex', find: '(a)', replace: 'b', flags: 'g', ...rule }] });
  const config = [cmd('a', { testText: 'a', preCommands: ['b', 'c'], postCommands: ['d', 'e'] }), cmd('b'), cmd('c'), cmd('d'), cmd('e'), cmd('loop', { preCommands: ['a'] })];
  const click = async (label: string) => call(() => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click());
  const selected = () => state.p.left.commands.find((c: any) => c.id === state.p.left.selectedId);
  try {
    act(() => { ReactDOM.render(<I18nProvider><App /></I18nProvider>, host); }); await flush();
    await call(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'config', payload: config } })));
    await call(() => state.p.left.onSelectCommand('a'));
    expect(selected().id).toBe('a');
    const menus = () => Object.values(state.menus).filter((p: any) => p.options?.some((o: any) => o.id === 'b') && !p.name);
    let [pre, post] = menus(); expect(pre).toBeTruthy();
    for (const id of ['', 'b', 'loop', 'd', 'e']) await call(() => menus()[0].onToggle(id));
    expect(state.post).toHaveBeenCalledWith(expect.objectContaining({ type: 'showInfo' }));
    await call(() => post.onToggle('b'));
    const preChip = state.chips.findLast(p => p.items.some((i: any) => i.id === 'c'));
    await call(() => preChip.onReorder(['d', 'c', 'b'])); await call(() => preChip.onReorder(['bad'])); await call(() => preChip.onRemove('b'));
    const postChip = state.chips.at(-1); await call(() => postChip.onReorder(['b', 'e', 'd'])); await call(() => postChip.onRemove('e'));
    expect(selected().rules[0].preCommands).toEqual(['d', 'c']); expect(selected().rules[0].postCommands).toEqual(['b', 'd']);
    for (const flag of ['i', 'i', 'g', 'g']) await call(() => state.p.expr.onToggleFlag(flag));
    await click('Enabled'); await click('Disabled'); expect(selected().rules[0].enable).toBeUndefined();
    await call(() => state.checks['Apply pre hooks'].onChange(true)); await call(() => state.checks['Apply post hooks'].onChange(true));
    await call(() => state.p.expr.onChange('(a)(b)')); await call(() => state.p.expr.onAfterChange());
    await call(() => state.p.title.onCommit('[bad]')); expect(selected().rules[0].title).toBeUndefined();
    await call(() => state.p.title.onCommit('Named')); await call(() => state.p.title.onCommit(undefined)); await call(() => state.p.title.onCommit('Named')); await call(() => state.p.title.onCommit('Named')); expect(selected().rules[0].title).toBe('Named');
    await call(() => state.p.replace.onChange('$2')); await call(() => state.p.text.onChange('ab'));
    await call(() => state.p.switch.onChange('map')); expect(state.p.map).toBeTruthy();
    await call(() => state.p.map.onChangeMap({ mode: 'text', cases: [{ find: 'a', replace: 'A' }] })); expect(selected().rules[0].map.cases[0].replace).toBe('A');
    const split = state.splits.at(-1); await call(() => split.onMouseDown({ clientX: 200, preventDefault: vi.fn() })); await call(() => document.dispatchEvent(new MouseEvent('mousemove', { clientX: 240 }))); document.dispatchEvent(new MouseEvent('mouseup'));
    await call(() => state.p.switch.onChange('template')); await call(() => state.menus['rr-engine'].onToggle('wildcard')); expect(selected().rules[0].engine).toBe('wildcard');
    await call(() => state.menus['rr-engine'].onToggle('text')); await call(() => state.menus['rr-engine'].onToggle('regex'));
    await click('Save'); await call(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))); expect(state.post).toHaveBeenCalledWith(expect.objectContaining({ type: 'setConfig' }));
    await call(() => state.p.expr.onChange('changed')); await click('Reset'); expect(state.p.left.commands.find((c: any) => c.id === 'a').rules[0].find).toBe('(a)(b)'); await call(() => state.p.left.onSelectCommand('a'));
    await call(() => state.p.result.onTruncated());
    await click('Copy'); expect(state.copy).toHaveBeenCalled(); state.copy.mockResolvedValueOnce(false); await click('Copy');
    await call(() => state.p.tabs.onChange('list')); await call(() => state.p.list.onTruncated()); await call(() => state.p.list.onCtrlA()); await click('Copy');
    await call(() => state.p.tabs.onChange('details')); await call(() => state.p.tabs.onChange('explain')); await call(() => state.p.tabs.onChange('replace'));
    await click('Highlight');
    for (const split of [state.splits.findLast(p => p.orientation === 'horizontal'), state.splits.find(p => p.orientation === 'vertical')]) { await call(() => split.onMouseDown({ clientX: 200, clientY: 300, preventDefault: vi.fn() })); await call(() => document.dispatchEvent(new MouseEvent('mousemove', { clientX: 250, clientY: 280 }))); document.dispatchEvent(new MouseEvent('mouseup')); }
    await call(() => state.p.left.onReorderCommands(['e', 'd', 'c', 'b', 'a', 'loop'])); expect(state.p.left.commands.filter((c: any) => c.id !== 'a')[0].id).toBe('e');
    await click('New Rule'); const uids = state.p.left.getRuleUids('a'); await call(() => state.p.left.onReorderRules('a', [...uids].reverse())); await call(() => state.p.left.onReorderRules('a', []));
    await call(() => state.checks['Apply previous rules'].onChange(true)); await call(() => state.p.expr.onChange('x'));
    await call(() => state.p.left.onDeleteRule('a', 1));
    await call(() => state.checks['Save test text'].onChange(false)); await call(() => state.p.text.onChange('Unsaved')); await call(() => state.checks['Save test text'].onChange(true));
    expect(selected().rules[0].testText).toBe('Unsaved');
    const lateText = state.p.text.onChange;
    await call(() => state.p.router.setCommands(config.map(c => c.id === 'a' ? { ...c, rules: [{ ...c.rules[0], testText: undefined }] } : c)));
    await call(() => lateText('late after config')); expect(selected().rules[0].testText).toBeUndefined();
    await call(() => state.p.left.onChangeSearch('a')); await call(() => state.p.left.onChangeSearch(''));
    expect(state.p.left.isRuleDirty(selected(), 99)).toBe(false);
    await call(() => state.p.left.onReorderRules('missing', [])); await call(() => state.p.left.onReorderCommands(['a', 'a', 'a']));
    const staleMap = state.p.map; await call(() => state.p.left.onSelectRule(99));
    await call(() => state.p.replace.onChange('ignored')); await call(() => staleMap.onChangeMap({ mode: 'text', cases: [] }));
    await call(() => state.p.left.onSelectRule(0));
    state.modal.mockRejectedValueOnce(new Error('cancel')); await call(() => { void state.p.left.onConfirm('cancel'); });
    state.modal.mockResolvedValueOnce(false); await call(() => { void state.p.left.onConfirm('confirm'); });
    await call(() => window.dispatchEvent(new ErrorEvent('error', { message: 'boom' })));
    await call(() => window.dispatchEvent(new ErrorEvent('error')));
    const error = new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications', cancelable: true }); await call(() => window.dispatchEvent(error)); expect(error.defaultPrevented).toBe(true);
    await call(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true })));
    const vertical = () => state.splits.findLast(p => p.orientation === 'vertical');
    await call(() => vertical().toggleButton.onClick()); await call(() => vertical().onMouseDown({ preventDefault: vi.fn() })); await call(() => vertical().toggleButton.onClick());
    expect(state.p.left.getRuleUids('')).toEqual([]); expect(state.p.left.getRuleUids('missing')).toEqual([]);
    await call(() => state.p.router.setCommands([])); expect(state.p.left.commands).toEqual([]);
    await call(() => state.buttons['New Rule'].onClick()); await call(() => state.p.replace.onChange('ignored')); await call(() => state.checks['Save test text'].onChange(true)); await call(() => state.p.text.onChange('empty'));
    await call(() => state.p.left.onReorderCommands(['a', 'b'])); await call(() => state.p.router.setCommands(config)); await call(() => state.p.left.onSelectCommand('a'));
    await call(() => state.menus['rr-ui-language'].onToggle('zh-CN')); expect(host.textContent).toContain('💾');
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); }
});




test('App 边界：缺省 flags、异常 hook 预览和打开弹窗期间卸载', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); localStorage.setItem('regexpReplacer.uiLanguage', 'en');
  const seed = [{ id: 'dev_sample_one', title: 'Sample', rules: [{ engine: 'text', find: 'a', replace: 'b' }] }];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => seed }));
  state.modal.mockResolvedValue({ ok: true, removeFromOthers: false, referrerEntriesToStrip: [] }); state.post.mockClear();
  const host = document.createElement('div'); document.body.appendChild(host);
  const flush = async () => { await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(250); await Promise.resolve(); }); };
  const call = async (f: () => void) => { act(() => { f(); }); await flush(); };
  const commands: any[] = [{ id: 'a', title: 'A', rules: [{ engine: 'regex', find: 'a', replace: 'b' }] }, { id: 'b', title: 'B', rules: [{ engine: 'regex', find: '[', replace: 'b' }] }, { id: 'c', title: 'C', rules: [{ engine: 'text', find: 'a', replace: 'c', preCommands: ['c'] }] }];
  try {
    act(() => { ReactDOM.render(<I18nProvider><App /></I18nProvider>, host); }); await flush();
    await call(() => state.p.router.setCommands(commands)); await call(() => state.p.left.onSelectCommand('a'));
    expect(state.p.expr.regexEnabledFlags).toBe('g'); await call(() => state.p.expr.onToggleFlag('i'));
    const menus = () => Object.values(state.menus).filter((p: any) => !p.name && p.options?.some((o: any) => o.id === 'b'));
    await call(() => menus()[0].onToggle('c')); await call(() => menus()[1].onToggle('b'));
    await call(() => state.p.replace.onChange('b')); await call(() => state.p.text.onChange('a')); await call(() => state.checks['Apply pre hooks'].onChange(true)); await call(() => state.checks['Apply post hooks'].onChange(true));
    expect(state.p.result.fallbackText).toBe('b');
    const chips = state.chips.slice(-2);
    await call(() => state.p.router.setCommands(commands));
    await call(() => chips[0].onRemove('c')); await call(() => chips[1].onRemove('b'));
    await call(() => chips[0].onReorder([])); await call(() => chips[1].onReorder([]));
    await call(() => state.p.router.setCommands([{ ...commands[0], rules: [{ engine: 'wildcard', find: '*', replace: 'z', wildcardOptions: { dotAll: true }, preCommands: ['missing'], postCommands: ['missing'] }] }, commands[1]]));
    await call(() => state.p.tabs.onChange('details')); await call(() => state.p.tabs.onChange('explain')); await call(() => state.p.tabs.onChange('replace'));
    await call(() => state.p.router.setCommands([{ ...commands[0], rules: [{ engine: 'regex', find: '[', replace: '' }] }])); await call(() => state.p.text.onChange('a')); expect(state.p.result.replacedCount).toBe(0);
    await call(() => state.p.switch.onChange('map'));
    const lateMap = state.p.map; const lateSwitch = state.p.switch;
    const title = state.p.title; const replace = state.p.replace;
    await call(() => state.p.router.setCommands([{ ...commands[0], rules: [] }])); await call(() => title.onCommit('Late title')); await call(() => replace.onChange('late')); await call(() => lateMap.onChangeMap({ mode: 'text', cases: [] })); await call(() => lateSwitch.onChange('template'));
    await call(() => state.checks['Save test text'].onChange(true));
    await call(() => state.p.router.setCommands(commands));
    await call(() => state.p.left.onSelectRule(99)); await call(() => state.p.left.onReorderRules('a', state.p.left.getRuleUids('a'))); await call(() => state.p.left.onSelectRule(0));
    await call(() => state.p.left.onReorderCommands(['a', 'b']));
    await call(() => state.menus['rr-ui-language'].onToggle('zh-CN')); await call(() => state.menus['rr-ui-language'].onToggle('en'));
    let resolveRename!: (value: string) => void; state.modal.mockImplementationOnce(() => new Promise<string>(resolve => { resolveRename = resolve; }));
    act(() => { state.p.left.onRenameCommand('a', 'A'); }); act(() => { ReactDOM.unmountComponentAtNode(host); }); await act(async () => { resolveRename('Late rename'); await Promise.resolve(); });
    expect(state.post.mock.calls.filter(c => c[0].type === 'setConfig').at(-1)?.[0].payload.some((c: any) => c.title === 'Late rename')).not.toBe(true);
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); }
});

test('App 无未保存修改时合并种子翻译，重命名保存和语言请求在卸载后取消', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); localStorage.setItem('regexpReplacer.uiLanguage', 'en');
  state.showArrow = false; localStorage.setItem('regexpReplacer.splitterToggleArrowVisible', '0');
  const sample = { id: 'dev_sample_one', title: 'Original', rules: [{ engine: 'text', find: 'a', replace: 'b' }] };
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ ...sample, title: 'Translated' }] });
  vi.stubGlobal('fetch', fetch); state.post.mockClear();
  const host = document.createElement('div'); document.body.appendChild(host);
  const flush = async () => { await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(250); await Promise.resolve(); }); };
  const call = async (f: () => void) => { act(() => { f(); }); await flush(); };
  try {
    act(() => { ReactDOM.render(<I18nProvider><App /></I18nProvider>, host); }); await flush();
    await call(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'config', payload: [sample] } })));
    await call(() => state.p.left.onSelectCommand(sample.id));
    await call(() => state.menus['rr-ui-language'].onToggle('zh-CN'));
    expect(state.p.left.commands.find((c: any) => c.id === sample.id).title).toBe('Translated');
    await call(() => state.p.left.onReorderRules('missing', []));
    let resolveFetch!: (value: any) => void; fetch.mockImplementationOnce(() => new Promise(resolve => { resolveFetch = resolve; }));
    act(() => { state.menus['rr-ui-language'].onToggle('en'); });
    state.modal.mockResolvedValueOnce('Renamed');
    act(() => { state.p.left.onRenameCommand(sample.id, undefined); }); await act(async () => { await Promise.resolve(); });
    expect(state.p.left.commands.find((c: any) => c.id === sample.id).title).toBe('Renamed');
    const saves = state.post.mock.calls.filter(c => c[0].type === 'setConfig').length;
    act(() => { ReactDOM.unmountComponentAtNode(host); });
    await act(async () => { resolveFetch({ ok: true, json: async () => [sample] }); await Promise.resolve(); vi.advanceTimersByTime(250); });
    expect(state.post.mock.calls.filter(c => c[0].type === 'setConfig')).toHaveLength(saves);
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); state.showArrow = true; vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); }
});

