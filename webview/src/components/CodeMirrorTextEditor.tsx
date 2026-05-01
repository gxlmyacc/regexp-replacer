import React, { memo, useEffect, useMemo, useRef } from 'react';
import { EditorView, keymap, lineNumbers, placeholder, type ViewUpdate } from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import './CodeMirrorTextEditor.scss';

export type CodeMirrorTextEditorProps = {
  value: string;
  className?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onEditorReady?: (view: EditorView) => void;
  extensions?: any[];
  lineNumbers?: boolean;
};

/**
 * 通用 CodeMirror 文本编辑器组件（用于测试文本区域，受控）。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const CodeMirrorTextEditor = memo(function CodeMirrorTextEditor(props: CodeMirrorTextEditorProps): React.ReactElement {
  const { value, className, placeholder: ph, onChange, onEditorReady, extensions = [], lineNumbers: showLineNumbers = true } = props;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isApplyingValueRef = useRef(false);
  const lastValueRef = useRef<string>(value);
  const extCompartmentRef = useRef<Compartment | null>(null);

  const baseExtensions = useMemo(() => {
    const vscodeTheme = EditorView.theme(
      {
        '&': {
          height: '100%',
        },
        '.cm-content': {
          caretColor: 'var(--vscode-editorCursor-foreground, var(--rr-foreground))',
        },
        '.cm-cursor': {
          borderLeftColor: 'var(--vscode-editorCursor-foreground, var(--rr-foreground))',
        },
        '.cm-selectionBackground, .cm-content ::selection': {
          backgroundColor:
            'var(--vscode-editor-selectionBackground, var(--rr-list-activeSelectionBackground, rgba(0, 120, 212, 0.35)))',
        },
        '.cm-activeLine': {
          backgroundColor: 'rgba(127,127,127,0.08)',
        },
        '.cm-gutters': {
          backgroundColor: 'transparent',
          color: 'var(--vscode-editorLineNumber-foreground, rgba(127,127,127,0.75))',
          border: 'none',
        },
      },
      { dark: true },
    );

    const updateListener = EditorView.updateListener.of((u: ViewUpdate) => {
      if (!u.docChanged) return;
      if (isApplyingValueRef.current) return;
      const next = u.state.doc.toString();
      lastValueRef.current = next;
      onChange?.(next);
    });

    return [
      showLineNumbers ? lineNumbers() : [],
      history(),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      ph ? placeholder(ph) : [],
      EditorView.lineWrapping,
      vscodeTheme,
      updateListener,
    ];
  }, [onChange, ph, showLineNumbers]);

  useEffect(() => {
    if (!hostRef.current) return;
    if (viewRef.current) return;

    const extCompartment = new Compartment();
    extCompartmentRef.current = extCompartment;

    const state = EditorState.create({
      doc: value ?? '',
      extensions: [extCompartment.of([...baseExtensions, ...extensions])],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    onEditorReady?.(view);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    const extCompartment = extCompartmentRef.current;
    if (!view || !extCompartment) return;
    view.dispatch({
      effects: extCompartment.reconfigure([...baseExtensions, ...extensions]),
    });
  }, [baseExtensions, extensions]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const next = value ?? '';
    if (next === lastValueRef.current) return;

    isApplyingValueRef.current = true;
    try {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: next },
      });
      lastValueRef.current = next;
    } finally {
      queueMicrotask(() => {
        isApplyingValueRef.current = false;
      });
    }
  }, [value]);

  return <div ref={hostRef} className={className} />;
});

