import React, { useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { expect, test, vi } from 'vitest';
import { EditorView } from '@codemirror/view';
import { CodeMirrorTextEditor } from '../../webview/src/components/CodeMirrorTextEditor';
import { useTesterMatchesCm } from '../../webview/src/hooks/useTesterMatchesCm';
import * as highlighter from '../../webview/src/features/tester/matchHighlighter';

test('diagnose matching editor updates', async () => {
  let editor: EditorView;
  const errors: unknown[][] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args));
  const host = document.createElement('div');
  document.body.appendChild(host);
  const rule = { engine: 'regex' as const, find: 'a+', replace: '', flags: 'g' };
  const computeSpy = vi.spyOn(highlighter, 'computeMatches');
  function Harness() {
    const viewRef = useRef<EditorView | null>(null);
    const [ready, setReady] = useState(false);
    const [text, setText] = useState('aaaa');
    const [index, setIndex] = useState<number | undefined>(undefined);
    const onReady = useCallback((view: EditorView) => {
      editor = view;
      viewRef.current = view;
      setReady(true);
    }, []);
    const matches = useTesterMatchesCm({ isReady: ready, viewRef, selectedRule: rule, depsKey: 'a+', text,
      currentMatchIndex: index, setCurrentMatchIndex: setIndex });
    return <CodeMirrorTextEditor value={text} onChange={setText} onEditorReady={onReady} extensions={matches.cmExtensions} />;
  }
  try {
    act(() => { ReactDOM.render(<Harness />, host); });
    await new Promise((resolve) => setTimeout(resolve, 250));
    computeSpy.mockClear();
    editor!.dispatch({ selection: { anchor: 2 } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(errors.some((args) => args.some((arg) => String(arg).includes('Calls to EditorView.update are not allowed')))).toBe(true);
    expect(host.childElementCount).toBe(0);
    console.log('CONFIRMED: moving cursor inside an existing match triggers nested EditorView.update and unmounts React root');
    // Dispatch outside act to mirror CodeMirror's native event handler.
    for (const next of ['a', '', 'aaaa', 'a', 'aaaaaaaa', 'a']) {
      try {
        editor!.dispatch({ changes: { from: 0, to: editor!.state.doc.length, insert: next }, selection: { anchor: 0 } });
        console.log('IMMEDIATE COMPUTATIONS', next, computeSpy.mock.calls.length);
      } catch (e) {
        errors.push([e]);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      console.log('AFTER DEBOUNCE', next, computeSpy.mock.calls.length);
      computeSpy.mockClear();
    }
    console.log('DIAGNOSTIC ERRORS', errors.map((args) => args.map((arg) => arg instanceof Error ? arg.stack : String(arg))));
  } finally {
    act(() => { ReactDOM.unmountComponentAtNode(host); });
    host.remove();
    spy.mockRestore();
  }
});
