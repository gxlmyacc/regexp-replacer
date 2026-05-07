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
  /**
   * 统计编辑器内容区内错误级诊断波浪线节点数量。
   *
   * @param host 挂载容器。
   * @returns 同时含 diagnostic-underline 与 severity-error 的节点数。
   */
  function countRegexErrorMarks(host: HTMLElement): number {
    const root = host.querySelector('.cm-content');
    if (!root) return 0;
    return root.querySelectorAll('.rrRegexTok--diagnostic-underline.rrRegexTok--severity-error').length;
  }

  test('[]、[ ^ ] 不产生括号未匹配诊断下划线', () => {
    for (const value of ['[]', '[^]']) {
      const host = mount(
        <I18nProvider>
          <RegexExpressionEditor value={value} uiLanguage="zh-CN" onChange={() => {}} onAfterChange={() => {}} />
        </I18nProvider>,
      );
      try {
        expect(countRegexErrorMarks(host)).toBe(0);
      } finally {
        unmount(host);
      }
    }
  });

  test('未闭合 ( 时出现错误下划线装饰', () => {
    const host = mount(
      <I18nProvider>
        <RegexExpressionEditor value="(" uiLanguage="zh-CN" onChange={() => {}} onAfterChange={() => {}} />
      </I18nProvider>,
    );
    try {
      expect(countRegexErrorMarks(host)).toBeGreaterThan(0);
    } finally {
      unmount(host);
    }
  });

  test('捕获组开括号后渲染 VS Code 式占宽序号 inlay（.rrRegexCaptureInlay）', () => {
    const host = mount(
      <I18nProvider>
        <RegexExpressionEditor value="(a)" uiLanguage="zh-CN" onChange={() => {}} onAfterChange={() => {}} />
      </I18nProvider>,
    );
    try {
      const inlay = host.querySelector('.cm-content .rrRegexCaptureInlay');
      expect(inlay).not.toBeNull();
      expect(inlay?.textContent).toBe('1');
    } finally {
      unmount(host);
    }
  });

  test('不必要转义显示警告波浪线（severity-warning）', () => {
    const host = mount(
      <I18nProvider>
        <RegexExpressionEditor value={'\\a'} uiLanguage="zh-CN" onChange={() => {}} onAfterChange={() => {}} />
      </I18nProvider>,
    );
    try {
      expect(
        host.querySelectorAll('.cm-content .rrRegexTok--diagnostic-underline.rrRegexTok--severity-warning').length,
      ).toBeGreaterThan(0);
    } finally {
      unmount(host);
    }
  });

  test('命名捕获组前缀带 .rrRegexTok--named-group-header', () => {
    const host = mount(
      <I18nProvider>
        <RegexExpressionEditor value="(?<year>)" uiLanguage="zh-CN" onChange={() => {}} onAfterChange={() => {}} />
      </I18nProvider>,
    );
    try {
      expect(host.querySelectorAll('.cm-content .rrRegexTok--named-group-header').length).toBeGreaterThan(0);
    } finally {
      unmount(host);
    }
  });

  test('通过 EditorView.dispatch 触发 onChange', () => {
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
    } finally {
      unmount(host);
    }
  });
});

