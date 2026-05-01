import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import * as TestUtils from 'react-dom/test-utils';
import { describe, expect, test, vi } from 'vitest';
import type { ReplaceCommand } from '../../src/types';
import { useAppModals } from '../../webview/src/features/app/modals/modals';

function tick(): Promise<void> {
  return new Promise((r) => window.setTimeout(r, 0));
}

describe('modals', () => {
  test('confirmDeleteCommandWithDeps：确认后删除命令，且删除后会确保至少保留 1 个草稿', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const showHookDepModal = vi.fn(async () => ({ ok: true, removeFromOthers: false, referrerEntriesToStrip: [] }));
    const requestSaveFrom = vi.fn();
    const scheduleAutoSaveAfterDelete = vi.fn();

    const commandsRef = { current: [{ id: 'a', title: 'A', rules: [] as any }] as ReplaceCommand[] };
    const selectedIdRef = { current: 'a' as string | undefined };
    const pendingAutoSelectIdRef = { current: undefined as string | undefined };

    let nextCommands: ReplaceCommand[] | null = null;

    function Harness(): React.ReactElement {
      const api = useAppModals({
        lang: 'en' as any,
        t: {
          ruleLabel: 'Rule',
          cancel: 'cancel',
          confirm: 'ok',
          untitledCommand: 'Untitled command',
          hookDepPhasePre: 'Pre',
          hookDepPhasePost: 'Post',
          hookDepModalDeleteTitle: 'Delete',
          hookDepIntroDelete: 'Intro',
          hookDepModalDisableTitle: 'Disable',
          hookDepIntroDisableSimple: 'Disable?',
          hookDepIntroDisableDepsHint: 'Deps',
          hookDepRemoveFromOthers: 'Remove',
          hookDepRowCheckboxAria: 'Remove row ref',
        },
        modalApi: {
          openRenameCommand: async () => {},
          requestConfirm: async () => true,
          showHookDepModal,
        },
        toast: { show: vi.fn() },
        commandsRef: commandsRef as any,
        selectedIdRef: selectedIdRef as any,
        selectedRuleIndex: 0,
        setCommands: (updater: any) => {
          const prev = commandsRef.current;
          const next = typeof updater === 'function' ? updater(prev) : updater;
          commandsRef.current = next;
          nextCommands = next;
        },
        setDirty: () => {},
        setSelectedRuleIndex: () => {},
        pendingAutoSelectIdRef: pendingAutoSelectIdRef as any,
        scheduleAutoSaveAfterDelete,
        requestSaveFrom,
      });

      useEffect(() => {
        void api.confirmDeleteCommandWithDeps('a');
      }, []);
      return <div />;
    }

    await TestUtils.act(async () => {
      ReactDOM.render(<Harness />, host);
      await tick();
    });

    expect(showHookDepModal).toHaveBeenCalled();
    expect(nextCommands).not.toBeNull();
    expect(nextCommands?.length).toBe(1);
    expect(nextCommands?.[0].title).toContain('Untitled');
    expect(scheduleAutoSaveAfterDelete).toHaveBeenCalled();

    ReactDOM.unmountComponentAtNode(host);
    host.remove();
  });

  test('requestRuleEnableButtonClick：禁用时会弹确认并触发自动保存（validateNames=false）', async () => {
    vi.useFakeTimers();
    const host = document.createElement('div');
    document.body.appendChild(host);

    const showHookDepModal = vi.fn(async () => ({ ok: true, removeFromOthers: false, referrerEntriesToStrip: [] }));
    const requestSaveFrom = vi.fn();

    const commandsRef = {
      current: [
        { id: 'a', title: 'A', rules: [{ engine: 'regex', find: 'x', replace: 'y', flags: 'g', enable: true } as any] },
      ] as ReplaceCommand[],
    };
    const selectedIdRef = { current: 'a' as string | undefined };

    function Harness(): React.ReactElement {
      const api = useAppModals({
        lang: 'en' as any,
        t: {
          ruleLabel: 'Rule',
          cancel: 'cancel',
          confirm: 'ok',
          untitledCommand: 'Untitled command',
          hookDepPhasePre: 'Pre',
          hookDepPhasePost: 'Post',
          hookDepModalDeleteTitle: 'Delete',
          hookDepIntroDelete: 'Intro',
          hookDepModalDisableTitle: 'Disable',
          hookDepIntroDisableSimple: 'Disable?',
          hookDepIntroDisableDepsHint: 'Deps',
          hookDepRemoveFromOthers: 'Remove',
          hookDepRowCheckboxAria: 'Remove row ref',
        },
        modalApi: {
          openRenameCommand: async () => {},
          requestConfirm: async () => true,
          showHookDepModal,
        },
        toast: { show: vi.fn() },
        commandsRef: commandsRef as any,
        selectedIdRef: selectedIdRef as any,
        selectedRuleIndex: 0,
        setCommands: (updater: any) => {
          const prev = commandsRef.current;
          const next = typeof updater === 'function' ? updater(prev) : updater;
          commandsRef.current = next;
        },
        setDirty: () => {},
        setSelectedRuleIndex: () => {},
        pendingAutoSelectIdRef: { current: undefined } as any,
        scheduleAutoSaveAfterDelete: () => {},
        requestSaveFrom,
      });

      useEffect(() => {
        void api.requestRuleEnableButtonClick(() => {});
      }, []);
      return <div />;
    }

    await TestUtils.act(async () => {
      ReactDOM.render(<Harness />, host);
    });

    // 触发 setTimeout 自动保存
    await TestUtils.act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(showHookDepModal).toHaveBeenCalled();
    expect(requestSaveFrom).toHaveBeenCalled();
    const lastArgs = requestSaveFrom.mock.calls.at(-1);
    expect(lastArgs?.[1]).toEqual({ validateNames: false });

    ReactDOM.unmountComponentAtNode(host);
    host.remove();
    vi.useRealTimers();
  });
});

