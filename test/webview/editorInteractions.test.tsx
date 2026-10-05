import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { EditorView } from '@codemirror/view';
import { expect, test, vi } from 'vitest';
import { RegexExpressionEditor } from '../../webview/src/components/RegexExpressionEditor';
import { CodeMirrorTextEditor } from '../../webview/src/components/CodeMirrorTextEditor';
import { useTesterMatchesCm } from '../../webview/src/hooks/useTesterMatchesCm';
const hoverSources: any[] = [];
vi.mock('@codemirror/view', async () => ({ ...await vi.importActual<any>('@codemirror/view'), hoverTooltip: (source: any) => { hoverSources.push(source); return []; } }));

function MatchHarness({ pattern }: { pattern: string }): React.ReactElement {
  const view = React.useRef<EditorView | null>(null);
  const result = useTesterMatchesCm({ isReady: true, selectedRule: { engine: 'regex', find: pattern, replace: '' }, text: 'ab', depsKey: pattern, viewRef: view, currentMatchIndex: undefined, setCurrentMatchIndex: vi.fn() });
  return <CodeMirrorTextEditor value="ab" extensions={result.cmExtensions} onEditorReady={v => { view.current = v; }} />;
}

test('正则编辑器粘贴归一化、焦点括号高亮、诊断悬浮与受控更新', async () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  const change = vi.fn(); const after = vi.fn(); const blur = vi.fn(); const errors = vi.spyOn(console, 'error');
  const render = (value: string | undefined, flags = '') => act(() => { ReactDOM.render(<RegexExpressionEditor value={value as any} placeholder="Pattern" regexFlags={flags} uiLanguage="en" onChange={change} onAfterChange={after} onBlur={blur} />, host); });
  const getView = () => EditorView.findFromDOM(host.querySelector('.cm-editor')!)!;
  try {
    render('(?<name>(a[bc]))|d+'); const view = getView();
    localStorage.setItem('rr.regex.debug', '1'); const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    act(() => { view.focus(); view.dispatch({ selection: { anchor: 10 } }); });
    expect(debug).toHaveBeenCalled(); expect(host.querySelector('.rrRegexTok--pair-active')).not.toBeNull();
    const storage = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    act(() => { view.dispatch({ selection: { anchor: 11 } }); }); storage.mockRestore();
    Simulate.keyDown(view.contentDOM, { key: 'Enter', keyCode: 13 });
    view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    view.contentDOM.dispatchEvent(new FocusEvent('blur')); expect(blur).toHaveBeenCalled();
    const inlay = host.querySelector('.rrRegexCaptureInlay')!; inlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    act(() => { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'a\r\nb\nc\rd' }, selection: { anchor: 7 } }); });
    expect(view.state.doc.toString()).toBe('abcd'); expect(change).toHaveBeenLastCalledWith('abcd'); expect(after).toHaveBeenCalled(); expect(errors).not.toHaveBeenCalled();
    render('(?<open>a'); expect(host.querySelector('.rrRegexTok--named-group-header')).not.toBeNull();
    render('['); const source = hoverSources.at(-1); const tooltip = source(getView(), 0); expect(tooltip.create().dom.textContent).toBeTruthy(); expect(source(getView(), 10)).toBeNull();
    render(undefined); expect(getView().state.doc.toString()).toBe('');
    await act(async () => { await Promise.resolve(); });
    render('()'); act(() => { getView().focus(); getView().dispatch({ selection: { anchor: 1 } }); });
    render('(?:a){2}|(?=b).'); expect(getView().state.doc.toString()).toBe('(?:a){2}|(?=b).');
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); localStorage.removeItem('rr.regex.debug'); vi.restoreAllMocks(); }
});

test('测试文本悬浮提示包含范围和捕获组，未命中不显示', async () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  try {
    act(() => { ReactDOM.render(<MatchHarness pattern="(a)(b)" />, host); });
    await act(async () => { await Promise.resolve(); });
    const source = hoverSources.at(-1); expect(source(null, 8)).toBeNull();
    const tooltip = source(null, 1); expect(tooltip.pos).toBe(0); expect(tooltip.end).toBe(2);
    expect(tooltip.create().dom.textContent).toContain('group #2: b');
    act(() => { ReactDOM.render(<MatchHarness pattern="(a)(x)?b" />, host); }); await act(async () => { await Promise.resolve(); });
    expect(source(null, 1).create().dom.textContent).toContain('group #2: ');
    act(() => { ReactDOM.render(<MatchHarness pattern="ab" />, host); }); await act(async () => { await Promise.resolve(); });
    expect(source(null, 0).create().dom.textContent).not.toContain('group #');
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); }
});

test('受控测试文本更新不回调 onChange，最新回调及无行号配置生效', async () => {
  const host = document.createElement('div'); document.body.appendChild(host); const first = vi.fn(); const second = vi.fn(); let view: EditorView;
  const render = (value: string | undefined, onChange?: (v: string) => void) => act(() => { ReactDOM.render(<CodeMirrorTextEditor value={value as any} onChange={onChange} lineNumbers={false} placeholder="Text" onEditorReady={v => { view = v; }} />, host); });
  try {
    render(undefined, first); await act(async () => { await Promise.resolve(); });
    expect(host.querySelector('.cm-lineNumbers')).toBeNull(); render('abc', second); expect(first).not.toHaveBeenCalled(); expect(second).not.toHaveBeenCalled();
    await act(async () => { await Promise.resolve(); }); act(() => { view!.dispatch({ changes: { from: 0, to: 3, insert: 'next' } }); }); expect(second).toHaveBeenCalledWith('next');
    render('next'); await act(async () => { await Promise.resolve(); }); act(() => { view!.dispatch({ changes: { from: 0, insert: 'x' } }); });
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); }
});

