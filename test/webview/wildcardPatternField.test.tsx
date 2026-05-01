import React from 'react';
import ReactDOM from 'react-dom';
import * as TestUtils from 'react-dom/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { WildcardPatternField } from '../../webview/src/components/WildcardPatternField';

vi.mock('../../webview/src/utils', async () => {
  const actual = await vi.importActual<typeof import('../../webview/src/utils')>('../../webview/src/utils');
  return {
    ...actual,
    autoResizeTextarea: vi.fn(),
  };
});

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

describe('WildcardPatternField', () => {
  test('singleline：渲染 token 高亮并回调 onChange', () => {
    const onChange = vi.fn<(v: string) => void>();
    const host = mount(
      <WildcardPatternField value={'a*?\\n\\t\\s+'} placeholder="ph" onChange={onChange} onAfterChange={() => {}} />,
    );
    try {
      // overlay 会渲染为 span token（至少包含 wildcard-many / wildcard-single / wildcard-escape / quant）
      const overlay = host.querySelector('.rrInput__overlay');
      expect(overlay).not.toBeNull();
      expect(overlay?.textContent).toContain('a');
      expect(overlay?.textContent).toContain('*');
      expect(overlay?.textContent).toContain('?');
      expect(overlay?.textContent).toContain('\\n');

      const input = host.querySelector('input.rrInput__control') as HTMLInputElement | null;
      expect(input).not.toBeNull();
      if (!input) return;
      TestUtils.act(() => {
        TestUtils.Simulate.change(input, { target: { value: 'x?' } });
      });
      expect(onChange).toHaveBeenCalledWith('x?');
    } finally {
      unmount(host);
    }
  });

  test('multiline：change/input 会触发 autoResizeTextarea', async () => {
    const mod = await import('../../webview/src/utils');
    const autoResizeTextarea = vi.mocked(mod.autoResizeTextarea);
    const onChange = vi.fn<(v: string) => void>();
    const host = mount(
      <WildcardPatternField value={''} mode="multiline" placeholder="ph" onChange={onChange} onAfterChange={() => {}} />,
    );
    try {
      const ta = host.querySelector('textarea.rrInput__control') as HTMLTextAreaElement | null;
      expect(ta).not.toBeNull();
      if (!ta) return;
      TestUtils.act(() => {
        TestUtils.Simulate.change(ta, { target: { value: 'a\nb' } });
        TestUtils.Simulate.input(ta);
      });
      expect(onChange).toHaveBeenCalledWith('a\nb');
      expect(autoResizeTextarea).toHaveBeenCalled();
    } finally {
      unmount(host);
    }
  });
});

