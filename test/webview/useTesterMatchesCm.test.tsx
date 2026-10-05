import React, { useCallback, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { EditorView } from '@codemirror/view';
import { CodeMirrorTextEditor } from '../../webview/src/components/CodeMirrorTextEditor';
import { useTesterMatchesCm, type UseTesterMatchesCmResult } from '../../webview/src/hooks/useTesterMatchesCm';
import type { ReplaceRule } from '../../webview/src/features/tester/matchHighlighter';
import * as highlighter from '../../webview/src/features/tester/matchHighlighter';

let editor: EditorView;
let result: UseTesterMatchesCmResult;
let host: HTMLDivElement;
const defaultRule: ReplaceRule = { engine: 'regex', find: 'a+', replace: '', flags: 'g' };

/** 使用真实 CodeMirror 和 React 状态更新链路，保留原生输入时的非批量更新行为。 */
function Harness({ rule = defaultRule, ready = true, before }: {
  rule?: ReplaceRule | null; ready?: boolean; before?: () => void;
}): React.ReactElement {
  const viewRef = useRef<EditorView | null>(null);
  const [mounted, setMounted] = useState(false);
  const [text, setText] = useState('aaaa');
  const [index, setIndex] = useState<number | undefined>();
  const [, setVersion] = useState(0);
  const onReady = useCallback((view: EditorView) => {
    editor = view;
    viewRef.current = view;
    setMounted(true);
  }, []);
  result = useTesterMatchesCm({ isReady: ready && mounted, viewRef, selectedRule: rule ?? undefined,
    depsKey: `${rule?.find}:${rule?.flags}`, text, currentMatchIndex: index,
    setCurrentMatchIndex: setIndex, onBeforeRecompute: before });
  return <CodeMirrorTextEditor value={text} extensions={result.cmExtensions} onEditorReady={onReady}
    onChange={(next) => { setText(next); setVersion((value) => value + 1); }} />;
}

/** 刷新 React effects 与用于避免编辑器嵌套更新的微任务。 */
async function flush(): Promise<void> {
  await act(async () => { await Promise.resolve(); });
}

async function render(props: React.ComponentProps<typeof Harness> = {}): Promise<void> {
  act(() => { ReactDOM.render(<Harness {...props} />, host); });
  await flush();
}

async function advance(milliseconds = 200): Promise<void> {
  act(() => { vi.advanceTimersByTime(milliseconds); });
  await flush();
}

/** 不包裹 act，确保测试能够发现 React 16 原生事件中的重入问题。 */
function edit(text: string): void {
  editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: text }, selection: { anchor: 0 } });
}

describe('test text matching with real CodeMirror', () => {
  test('late timer delivery after cancellation cannot publish an old computation', async () => {
    await render();
    const compute = vi.spyOn(highlighter, 'computeMatches');
    const callbacks: Array<() => void> = [];
    const setTimeout = window.setTimeout.bind(window);
    vi.spyOn(window, 'setTimeout').mockImplementation(((callback: () => void, delay: number) => {
      if (delay === 200) callbacks.push(callback);
      return setTimeout(callback, delay);
    }) as any);
    result.scheduleCompute(); result.scheduleCompute();
    act(() => { callbacks[0](); }); expect(compute).not.toHaveBeenCalled();
    act(() => { ReactDOM.unmountComponentAtNode(host); });
    act(() => { callbacks[1](); }); expect(compute).not.toHaveBeenCalled();
  });

  test('before-recompute can cancel its own request', async () => {
    await render(); const compute = vi.spyOn(highlighter, 'computeMatches');
    await render({ rule: { ...defaultRule, find: 'aa' }, before: () => result.clearMatches() });
    expect(compute).not.toHaveBeenCalled(); expect(result.matches).toEqual([]);
  });
  test('large matching documents limit decoration work to the viewport and cap', async () => {
    await render({ rule: { ...defaultRule, find: 'a' } });
    edit('a'.repeat(1500));
    await flush();
    await advance();
    expect(result.matches).toHaveLength(1500);
    expect(host.querySelectorAll('.regexpReplacerMatch').length).toBeLessThanOrEqual(1200);
    const viewport = vi.spyOn(editor, 'viewport', 'get').mockReturnValue({ from: 1000, to: 1003 });
    editor.dispatch({ selection: { anchor: 1001 } });
    await flush();
    expect(host.querySelector('.regexpReplacerMatchActive')).not.toBeNull();
    viewport.mockRestore();
  });

  test('non-Error failures are reported without leaving stale matches', async () => {
    vi.spyOn(highlighter, 'computeMatches').mockImplementation(() => { throw 'failed'; });
    await render();
    expect(result.matchError).toBe('failed');
    expect(result.matches).toEqual([]);
  });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    host = document.createElement('div');
    document.body.appendChild(host);
  });
  afterEach(async () => {
    act(() => { ReactDOM.unmountComponentAtNode(host); });
    await flush();
    host.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('cursor movement followed by editing never reenters EditorView.update or unmounts the page', async () => {
    const errors = vi.spyOn(console, 'error');
    await render();
    expect(result.matches[0].matchText).toBe('aaaa');
    editor.dispatch({ selection: { anchor: 2 } });
    edit('a');
    await flush();
    await advance();
    expect(host.querySelector('.cm-editor')).not.toBeNull();
    expect(result.matches[0].matchText).toBe('a');
    expect(errors).not.toHaveBeenCalled();
  });

  test('initial matching runs once; rapid edits compute only the latest text after 200ms', async () => {
    const compute = vi.spyOn(highlighter, 'computeMatches');
    const before = vi.fn();
    await render({ before });
    expect(compute).toHaveBeenCalledTimes(1);
    await advance();
    expect(compute).toHaveBeenCalledTimes(1);
    compute.mockClear();
    before.mockClear();
    edit('aa');
    await flush();
    await advance(100);
    edit('aaa');
    await flush();
    await advance(199);
    expect(compute).not.toHaveBeenCalled();
    await advance(1);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(compute).toHaveBeenCalledWith(defaultRule, 'aaa', { maxMatches: 5000 });
    expect(before).toHaveBeenCalledTimes(1);
  });

  test('rule changes immediately recompute and cancel pending text calculations', async () => {
    const compute = vi.spyOn(highlighter, 'computeMatches');
    await render();
    edit('aaa');
    await flush();
    compute.mockClear();
    await render({ rule: { ...defaultRule, find: 'a' } });
    expect(result.matches).toHaveLength(3);
    expect(compute).toHaveBeenCalledTimes(1);
    await advance();
    expect(compute).toHaveBeenCalledTimes(1);
  });

  test('editing clears obsolete highlights until the latest results are available', async () => {
    await render();
    expect(host.querySelector('.regexpReplacerMatch')).not.toBeNull();
    edit('z');
    expect(host.querySelector('.regexpReplacerMatch')).toBeNull();
    await flush();
    await advance();
    expect(result.matches).toEqual([]);
  });

  test('invalid expressions are reported and recover when corrected', async () => {
    await render({ rule: { ...defaultRule, find: '[' } });
    expect(result.matchError).toBeTruthy();
    expect(result.matches).toEqual([]);
    await render();
    expect(result.matchError).toBeUndefined();
    expect(result.matches).toHaveLength(1);
  });

  test('clear and unavailable rules cancel pending work', async () => {
    await render();
    edit('aa');
    await flush();
    act(() => { result.clearMatches(); });
    await advance();
    expect(result.matches).toEqual([]);
    await render({ rule: null });
    expect(result.matchError).toBeUndefined();
    expect(result.matches).toEqual([]);
  });

  test('readiness controls matching and unmount cancels pending calculations', async () => {
    const compute = vi.spyOn(highlighter, 'computeMatches');
    await render({ ready: false });
    expect(compute).not.toHaveBeenCalled();
    await render();
    expect(compute).toHaveBeenCalledTimes(1);
    edit('aa');
    await flush();
    act(() => { ReactDOM.unmountComponentAtNode(host); });
    await advance();
    expect(compute).toHaveBeenCalledTimes(1);
  });

  test('zero width matches remain list items without creating empty mark decorations', async () => {
    const errors = vi.spyOn(console, 'error');
    await render({ rule: { ...defaultRule, find: '(?=a)' } });
    expect(result.matches).toHaveLength(4);
    expect(host.querySelector('.regexpReplacerMatch')).toBeNull();
    expect(errors).not.toHaveBeenCalled();
  });
});
