import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import * as TestUtils from 'react-dom/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { useLeftPanelActions } from '../../webview/src/components/leftPanel/useLeftPanelActions';

/**
 * 渲染一次 hook 并把返回值透出到外部变量。
 *
 * @param props 传入 hook 的 options。
 * @returns { host, getLast }
 */
function renderHookOnce(props: any): { host: HTMLDivElement; getLast: () => any } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  let last: any;

  function Probe(): null {
    const v = useLeftPanelActions(props);
    useEffect(() => {
      last = v;
    });
    return null;
  }

  TestUtils.act(() => {
    ReactDOM.render(<Probe />, host);
  });

  return {
    host,
    getLast: () => last,
  };
}

function cleanup(host: HTMLDivElement): void {
  ReactDOM.unmountComponentAtNode(host);
  host.remove();
}

describe('useLeftPanelActions', () => {
  test('new command：若已存在未命名命令则选中它；否则创建并置顶', () => {
    const setCommands = vi.fn();
    const setSelectedId = vi.fn();
    const setSelectedRuleIndex = vi.fn();
    const setDirty = vi.fn();
    const setSearch = vi.fn();
    const vscodeApi = { postMessage: vi.fn() };

    const baseOpt = {
      setCommands,
      setSelectedId,
      setSelectedRuleIndex,
      setDirty,
      setSearch,
      search: '',
      vscodeApi,
      t: {
        untitledCommand: '未命名命令',
        searchPlaceholder: '',
        commandListTitle: '',
        newCommand: '',
        export: '',
        import: '',
        ruleLabel: '规则',
        ruleEnabled: '启用',
        ruleDisabled: '禁用',
        renameCommand: '',
        deleteCommand: '',
        deleteRule: '',
        confirmDeleteCommand: '',
        confirmDeleteRule: '',
        newCommandDisabledReason: '',
      },
      filtered: [],
      hasAnyUntitledCommand: false,
      selectedId: undefined,
      selectedIdRef: { current: undefined },
      selectedRuleIndex: 0,
      pendingAutoSelectIdRef: { current: undefined },
      createDraftCommand: (title: string) => ({ id: 'd', title, rules: [{ engine: 'regex', find: '', replace: '', flags: 'g' }] }),
      createDefaultRule: () => ({ engine: 'regex', find: '', replace: '', flags: 'g' }),
      scheduleAutoSaveAfterDelete: vi.fn(),
      onOpenRename: vi.fn(),
      isCommandDeletable: () => true,
      isCommandDirty: () => false,
      isRuleDirty: () => false,
    };

    // 已存在未命名命令：应直接选中
    {
      const { host, getLast } = renderHookOnce({
        ...baseOpt,
        commands: [{ id: 'u', title: '未命名命令', rules: [{ engine: 'regex', find: '', replace: '', flags: 'g' }] }],
      });
      try {
        getLast().onClickNewCommand();
        expect(setSelectedId).toHaveBeenCalledWith('u');
        expect(setSelectedRuleIndex).toHaveBeenCalledWith(0);
      } finally {
        cleanup(host);
      }
    }

    // 不存在：应创建并置顶
    {
      setSelectedId.mockClear();
      const { host, getLast } = renderHookOnce({ ...baseOpt, commands: [] });
      try {
        getLast().onClickNewCommand();
        expect(setCommands).toHaveBeenCalled();
        expect(setDirty).toHaveBeenCalledWith(true);
      } finally {
        cleanup(host);
      }
    }
  });

  test('export/import/delete：会发送消息并确保删除后有兜底草稿', () => {
    const setCommands = vi.fn((updater: any) => updater([{ id: 'a', title: 'A', rules: [{ engine: 'regex', find: '', replace: '', flags: 'g' }] }]));
    const setSelectedId = vi.fn();
    const setSelectedRuleIndex = vi.fn();
    const setDirty = vi.fn();
    const setSearch = vi.fn();
    const scheduleAutoSaveAfterDelete = vi.fn();
    const vscodeApi = { postMessage: vi.fn() };
    const selectedIdRef = { current: 'a' as string | undefined };
    const pendingAutoSelectIdRef = { current: undefined as string | undefined };

    const { host, getLast } = renderHookOnce({
      commands: [{ id: 'a', title: 'A', rules: [{ engine: 'regex', find: '', replace: '', flags: 'g' }] }],
      filtered: [],
      search: '',
      setCommands,
      setSelectedId,
      setSelectedRuleIndex,
      setDirty,
      setSearch,
      vscodeApi,
      t: {
        untitledCommand: '未命名命令',
        searchPlaceholder: '',
        commandListTitle: '',
        newCommand: '',
        export: '',
        import: '',
        ruleLabel: '规则',
        ruleEnabled: '启用',
        ruleDisabled: '禁用',
        renameCommand: '',
        deleteCommand: '',
        deleteRule: '',
        confirmDeleteCommand: '',
        confirmDeleteRule: '',
        newCommandDisabledReason: '',
      },
      hasAnyUntitledCommand: false,
      selectedId: 'a',
      selectedIdRef,
      selectedRuleIndex: 0,
      pendingAutoSelectIdRef,
      createDraftCommand: (title: string) => ({ id: 'd', title, rules: [{ engine: 'regex', find: '', replace: '', flags: 'g' }] }),
      createDefaultRule: () => ({ engine: 'regex', find: '', replace: '', flags: 'g' }),
      scheduleAutoSaveAfterDelete,
      onOpenRename: vi.fn(),
      isCommandDeletable: () => true,
      isCommandDirty: () => false,
      isRuleDirty: () => false,
    });

    try {
      getLast().onClickImport();
      expect(vscodeApi.postMessage).toHaveBeenCalledWith({ type: 'importCommands' });
      getLast().onClickExport();
      expect(vscodeApi.postMessage).toHaveBeenCalled();

      getLast().onDeleteCommand('a');
      expect(setDirty).toHaveBeenCalledWith(true);
      expect(scheduleAutoSaveAfterDelete).toHaveBeenCalled();
      expect(pendingAutoSelectIdRef.current).toBe('d');
    } finally {
      cleanup(host);
    }
  });
});

