import React from 'react';
import ReactDOM from 'react-dom';
import * as TestUtils from 'react-dom/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { ReplacementTemplateField } from '../../webview/src/components/ReplacementTemplateField';

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

describe('ReplacementTemplateField', () => {
  test('highlightEnabled：会把 $1/$2 拆成不同 span，并按 captureGroupLevels 上色', () => {
    const onChange = vi.fn<(v: string) => void>();
    const host = mount(
      <ReplacementTemplateField
        value={'$1$2 $$ $& \\n $<name>'}
        highlightEnabled={true}
        captureGroupLevels={[2, 5]}
        placeholder="ph"
        onChange={onChange}
        variant="line"
      />,
    );
    try {
      const overlay = host.querySelector('.rrInput__overlay');
      expect(overlay).not.toBeNull();

      const spans = Array.from(host.querySelectorAll('.replacement-template-field__tok--replacement-index'));
      // $1 与 $2 必须分开渲染（否则无法分色）
      expect(spans.length).toBeGreaterThanOrEqual(2);
      const s1 = spans.find((s) => (s as HTMLElement).textContent === '$1') as HTMLElement | undefined;
      const s2 = spans.find((s) => (s as HTMLElement).textContent === '$2') as HTMLElement | undefined;
      expect(s1).toBeTruthy();
      expect(s2).toBeTruthy();
      expect(s1?.className).toContain('replacement-index-l2');
      expect(s2?.className).toContain('replacement-index-l5');

      const input = host.querySelector('input.rrInput__control') as HTMLInputElement | null;
      expect(input).not.toBeNull();
      TestUtils.act(() => {
        TestUtils.Simulate.change(input as any, { target: { value: 'x$1' } });
      });
      expect(onChange).toHaveBeenCalledWith('x$1');
    } finally {
      unmount(host);
    }
  });

  test('highlightDisabled：不渲染 overlay（保持普通输入）', () => {
    const onChange = vi.fn<(v: string) => void>();
    const host = mount(<ReplacementTemplateField value={'$1'} highlightEnabled={false} onChange={onChange} />);
    try {
      expect(host.querySelector('.rrInput__overlay')).toBeNull();
    } finally {
      unmount(host);
    }
  });
});

