import React from 'react';
import ReactDOM from 'react-dom';
import { describe, expect, test } from 'vitest';
import { I18nProvider } from '../../webview/src/i18n/I18nProvider';
import { MatchDetailsPanel } from '../../webview/src/components/MatchDetailsPanel';

/**
 * 将 React 元素挂载到 DOM 容器中（用于无 Testing Library 的最小组件测试）。
 *
 * @param el React 元素。
 * @returns 容器元素。
 */
function mount(el: React.ReactElement): HTMLDivElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  ReactDOM.render(el, host);
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

describe('MatchDetailsPanel', () => {
  test('无分组时显示 “无分组” 文案；有 matchError 时显示错误块', () => {
    const host = mount(
      <I18nProvider>
        <MatchDetailsPanel
          engine="regex"
          flagsDisplay="g"
          matchError="bad"
          current={{ index: 0, startOffset: 1, endOffset: 2, matchText: 'x', groups: [] }}
        />
      </I18nProvider>,
    );
    try {
      expect(host.textContent).toContain('engine');
      expect(host.textContent).toContain('bad');
      const text = host.textContent ?? '';
      expect(text.includes('（无分组') || text.includes('No capture groups')).toBe(true);
    } finally {
      unmount(host);
    }
  });

  test('有分组时按顺序渲染 Group 1/2', () => {
    const host = mount(
      <I18nProvider>
        <MatchDetailsPanel
          engine="regex"
          flagsDisplay="g"
          current={{ index: 1, startOffset: 0, endOffset: 3, matchText: 'abc', groups: ['g1', 'g2'] }}
        />
      </I18nProvider>,
    );
    try {
      expect(host.textContent).toContain('Group 1');
      expect(host.textContent).toContain('g1');
      expect(host.textContent).toContain('Group 2');
      expect(host.textContent).toContain('g2');
    } finally {
      unmount(host);
    }
  });
});

