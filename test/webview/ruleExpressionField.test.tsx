import React from 'react';
import ReactDOM from 'react-dom';
import * as TestUtils from 'react-dom/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { RuleExpressionField } from '../../webview/src/components/RuleExpressionField';

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

describe('RuleExpressionField', () => {
  test('text 引擎：使用 textarea，onChange 会触发 autoResizeTextarea 与 onAfterChange', async () => {
    const mod = await import('../../webview/src/utils');
    const autoResizeTextarea = vi.mocked(mod.autoResizeTextarea);
    const onChange = vi.fn();
    const onAfterChange = vi.fn();
    const host = mount(
      <RuleExpressionField
        engine="text"
        value=""
        placeholder="ph"
        onChange={onChange}
        regexEnabledFlags={undefined}
        onToggleFlag={() => {}}
        flagLabels={{ flags: 'Flags', flagG: 'g', flagI: 'i', flagM: 'm', flagS: 's', flagU: 'u', flagY: 'y' }}
        uiLanguage="zh-CN"
        onAfterChange={onAfterChange}
      />,
    );
    try {
      const ta = host.querySelector('textarea.rule-expression-field__textarea') as HTMLTextAreaElement | null;
      expect(ta).not.toBeNull();
      TestUtils.act(() => {
        TestUtils.Simulate.change(ta as any, { target: { value: 'x' } });
      });
      expect(onChange).toHaveBeenCalledWith('x');
      expect(onAfterChange).toHaveBeenCalled();
      expect(autoResizeTextarea).toHaveBeenCalled();
    } finally {
      unmount(host);
    }
  });

  test('wildcard 引擎：渲染 WildcardPatternField（包含 overlay 容器）', () => {
    const host = mount(
      <RuleExpressionField
        engine="wildcard"
        value="a*"
        placeholder="ph"
        onChange={() => {}}
        regexEnabledFlags={undefined}
        onToggleFlag={() => {}}
        flagLabels={{ flags: 'Flags', flagG: 'g', flagI: 'i', flagM: 'm', flagS: 's', flagU: 'u', flagY: 'y' }}
        uiLanguage="zh-CN"
        onAfterChange={() => {}}
      />,
    );
    try {
      expect(host.querySelector('.wildcard-pattern-field')).not.toBeNull();
    } finally {
      unmount(host);
    }
  });
});

