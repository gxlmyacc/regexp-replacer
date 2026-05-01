import React from 'react';
import ReactDOM from 'react-dom';
import * as TestUtils from 'react-dom/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { EditorView } from '@codemirror/view';
import { RegexExpressionEditor } from '../../webview/src/components/RegexExpressionEditor';
import { I18nProvider } from '../../webview/src/i18n/I18nProvider';

/**
 * 将 React 元素挂载到 DOM 容器中（用于无 Testing Library 的最小组件测试）。
 *
 * @param el React 元素。
 * @returns 容器元素。
 */
function mount(el: React.ReactElement): HTMLDivElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  TestUtils.act(() => {
    ReactDOM.render(el, host);
  });
  return host;
}

/**
 * 卸载并移除容器，避免测试间污染。
 *
 * @param host 容器。
 * @returns 无返回值。
 */
function unmount(host: HTMLDivElement): void {
  ReactDOM.unmountComponentAtNode(host);
  host.remove();
}

describe('RegexExpressionEditor', () => {
  test('通过 EditorView.dispatch 触发 onChange，并在 selectionSet 时执行括号配对逻辑', () => {
    const onChange = vi.fn<(v: string) => void>();
    const onAfterChange = vi.fn();
    const host = mount(
      <I18nProvider>
        <RegexExpressionEditor value={'(a)'} uiLanguage="zh-CN" onChange={onChange} onAfterChange={onAfterChange} />
      </I18nProvider>,
    );
    try {
      const cm = host.querySelector('.cm-editor') as HTMLElement | null;
      expect(cm).not.toBeNull();
      const view = EditorView.findFromDOM(cm as any);
      expect(view).toBeTruthy();
      if (!view) return;

      TestUtils.act(() => {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '[()]' } });
      });
      expect(onChange).toHaveBeenCalledWith('[()]');
      expect(onAfterChange).toHaveBeenCalled();

      // 触发 selectionSet：把光标放到括号内部
      TestUtils.act(() => {
        view.dispatch({ selection: { anchor: 2 } });
      });
    } finally {
      unmount(host);
    }
  });
});

