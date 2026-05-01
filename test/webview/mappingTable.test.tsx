import React from 'react';
import ReactDOM from 'react-dom';
import * as TestUtils from 'react-dom/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { MappingTable, type MapReplaceConfig } from '../../webview/src/components/MappingTable';
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

describe('MappingTable', () => {
  test('text 模式：可输入匹配/替换、可新增行、重复 key 会标红', () => {
    const onChangeMap = vi.fn<(next: MapReplaceConfig) => void>();
    const host = mount(
      <I18nProvider>
        <MappingTable
          map={{ mode: 'text', cases: [] }}
          onChangeMap={onChangeMap}
          uiLanguage="zh-CN"
          t={{
            title: '映射表',
            colMatch: '匹配',
            colReplace: '替换',
            addRow: '新增一行',
            deleteRow: '删除该行',
            duplicateKey: '匹配列名称不能相同。',
            regexModeLabel: '正则',
          }}
        />
      </I18nProvider>,
    );
    try {
      const inputs = Array.from(host.querySelectorAll('input.rrInput__control')) as HTMLInputElement[];
      expect(inputs.length).toBe(2); // 默认 1 行：匹配 + 替换

      // 输入匹配/替换
      TestUtils.act(() => {
        TestUtils.Simulate.change(inputs[0], { target: { value: 'a' } });
        TestUtils.Simulate.change(inputs[1], { target: { value: 'b' } });
      });

      expect(onChangeMap).toHaveBeenCalled();
      const last = onChangeMap.mock.calls.at(-1)?.[0];
      expect(last?.mode).toBe('text');
      expect(last?.cases?.[0]).toEqual({ find: 'a', replace: 'b' });

      // 新增行
      const addBtn = host.querySelector('button[aria-label="新增一行"]') as HTMLButtonElement | null;
      expect(addBtn).not.toBeNull();
      TestUtils.act(() => {
        addBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      const inputs2 = Array.from(host.querySelectorAll('input.rrInput__control')) as HTMLInputElement[];
      expect(inputs2.length).toBe(4);

      // 第二行输入同样的 find 并触发 blur 校验（重复 key）
      TestUtils.act(() => {
        TestUtils.Simulate.change(inputs2[2], { target: { value: 'a' } });
        TestUtils.Simulate.blur(inputs2[2]);
      });

      const errorHosts = host.querySelectorAll('.rrInput--status-error');
      expect(errorHosts.length).toBeGreaterThan(0);
    } finally {
      unmount(host);
    }
  });

  test('可切换 regex 模式并落盘 mode=regex', () => {
    const onChangeMap = vi.fn<(next: MapReplaceConfig) => void>();
    const host = mount(
      <I18nProvider>
        <MappingTable
          map={{ mode: 'text', cases: [{ find: 'x', replace: 'y' }] }}
          onChangeMap={onChangeMap}
          uiLanguage="zh-CN"
          t={{
            title: '映射表',
            colMatch: '匹配',
            colReplace: '替换',
            colExpr: '表达式',
            colTemplate: '替换模板',
            addRow: '新增一行',
            deleteRow: '删除该行',
            duplicateKey: '匹配列名称不能相同。',
            regexModeLabel: '正则',
            regexModeTip: '提示',
          }}
        />
      </I18nProvider>,
    );
    try {
      const cb = host.querySelector('input[type="checkbox"][aria-label="正则"]') as HTMLInputElement | null;
      expect(cb).not.toBeNull();
      expect(cb?.checked).toBe(false);
      TestUtils.act(() => {
        TestUtils.Simulate.change(cb as any, { target: { checked: true } });
      });

      const last = onChangeMap.mock.calls.at(-1)?.[0];
      expect(last?.mode).toBe('regex');
    } finally {
      unmount(host);
    }
  });

  test('regex 模式：行内使用 CodeMirror 表达式框与替换模板高亮', () => {
    const onChangeMap = vi.fn<(next: MapReplaceConfig) => void>();
    const host = mount(
      <I18nProvider>
        <MappingTable
          map={{
            mode: 'regex',
            cases: [{ find: '(a)', replace: '$1' }],
          }}
          onChangeMap={onChangeMap}
          uiLanguage="zh-CN"
          t={{
            title: '映射表',
            colMatch: '匹配',
            colReplace: '替换',
            colExpr: '表达式',
            colTemplate: '替换模板',
            addRow: '新增一行',
            deleteRow: '删除该行',
            duplicateKey: '匹配列名称不能相同。',
            regexModeLabel: '正则',
          }}
        />
      </I18nProvider>,
    );
    try {
      // regex 模式左列应出现 CodeMirror 容器
      expect(host.querySelector('.rrMappingTableExprHost .cm-editor')).not.toBeNull();
      // 右列应渲染替换模板高亮 overlay
      expect(host.querySelector('.replacement-template-field__tok--replacement-index')).not.toBeNull();
    } finally {
      unmount(host);
    }
  });

  test('悬浮行时可显示并点击删除按钮（行数>1）', async () => {
    const onChangeMap = vi.fn<(next: MapReplaceConfig) => void>();
    const host = mount(
      <I18nProvider>
        <MappingTable
          map={{
            mode: 'text',
            cases: [
              { find: 'a', replace: '1' },
              { find: 'b', replace: '2' },
            ],
          }}
          onChangeMap={onChangeMap}
          uiLanguage="zh-CN"
          t={{
            title: '映射表',
            colMatch: '匹配',
            colReplace: '替换',
            addRow: '新增一行',
            deleteRow: '删除该行',
            duplicateKey: '匹配列名称不能相同。',
            regexModeLabel: '正则',
          }}
        />
      </I18nProvider>,
    );
    try {
      const rows = Array.from(host.querySelectorAll('.rrMappingTableRow')) as HTMLDivElement[];
      expect(rows.length).toBe(2);

      // 悬浮第 2 行，触发 hoverEl
      await TestUtils.act(async () => {
        TestUtils.Simulate.mouseEnter(rows[1] as any);
        await new Promise((r) => window.setTimeout(r, 0));
      });

      // 删除按钮在 Popover 内，通常会被 portal 到 body；这里全局查找
      const delBtn = document.querySelector('button.rrMappingTableDelBtn') as HTMLButtonElement | null;
      expect(delBtn).not.toBeNull();
      TestUtils.act(() => {
        delBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      // 触发 onChangeMap：cases 应从 2 变为 1
      const last = onChangeMap.mock.calls.at(-1)?.[0];
      expect(last?.cases?.length).toBe(1);
    } finally {
      unmount(host);
    }
  });
});

