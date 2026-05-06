import React from 'react';
import ReactDOM from 'react-dom';
import * as TestUtils from 'react-dom/test-utils';
import { describe, expect, test, vi } from 'vitest';
import type { ReplaceCommand } from '../../src/types';
import { useMessageRouter } from '../../webview/src/features/app/messages/messageRouter';
import { createDraftCommand } from '../../webview/src/utils';

function tick(): Promise<void> {
  return new Promise((r) => window.setTimeout(r, 0));
}

describe('messageRouter', () => {
  test('useMessageRouter：mount 时会请求 getConfig；收到 config 回包时按策略补草稿并选择首项', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const postMessage = vi.fn();
    const setSelectedId = vi.fn();
    const setSelectedRuleIndex = vi.fn();
    const setDirty = vi.fn();

    let lastCommands: ReplaceCommand[] | null = null;

    const commandsRef = { current: [] as ReplaceCommand[] };
    const selectedIdRef = { current: undefined as string | undefined };
    const savedSnapshotRef = { current: null as ReplaceCommand[] | null };
    const pendingAutoSelectIdRef = { current: undefined as string | undefined };
    const pendingAutoSelectRuleIndexRef = { current: null as number | null };
    const pendingAutoSavePayloadRef = { current: null as ReplaceCommand[] | null };
    const autoCreatedRef = { current: false };
    const initialUntitledEnsuredRef = { current: false };
    const draftIdRef = { current: undefined as string | undefined };
    const uiLocaleRef = { current: 'en' as const };

    function Harness(): React.ReactElement {
      useMessageRouter({
        vscodeApi: { postMessage },
        getUntitledTitle: () => 'Untitled command',
        setCommands: (next: any) => {
          const resolved = typeof next === 'function' ? next(commandsRef.current) : next;
          commandsRef.current = resolved;
          lastCommands = resolved;
        },
        setSelectedId,
        setSelectedRuleIndex,
        setDirty,
        commands: commandsRef.current,
        commandsRef: commandsRef as any,
        selectedIdRef: selectedIdRef as any,
        savedSnapshotRef: savedSnapshotRef as any,
        pendingAutoSelectIdRef: pendingAutoSelectIdRef as any,
        pendingAutoSelectRuleIndexRef: pendingAutoSelectRuleIndexRef as any,
        pendingAutoSavePayloadRef: pendingAutoSavePayloadRef as any,
        autoCreatedRef: autoCreatedRef as any,
        initialUntitledEnsuredRef: initialUntitledEnsuredRef as any,
        draftIdRef: draftIdRef as any,
        createDraftCommand,
        uiLocaleRef: uiLocaleRef as any,
      });
      return <div />;
    }

    await TestUtils.act(async () => {
      ReactDOM.render(<Harness />, host);
      await tick();
    });

    expect(postMessage).toHaveBeenCalledWith({ type: 'getConfig' });

    const payload: ReplaceCommand[] = [{ id: 'c1', title: 'My Command', rules: [] as any } as any];
    await TestUtils.act(async () => {
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'config', payload } }));
      await tick();
    });

    // 首次 config 且没有未命名命令：会补一个草稿置顶
    expect(lastCommands?.length).toBe(2);
    expect(lastCommands?.[0].title).toContain('Untitled');
    expect(lastCommands?.[1].id).toBe('c1');
    expect(setSelectedId).toHaveBeenCalledWith(lastCommands?.[0].id);

    ReactDOM.unmountComponentAtNode(host);
    host.remove();
  });

  test('useMessageRouter：pendingAutoSelect/pendingAutoSave 会在 effect 中被消费并落盘', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const postMessage = vi.fn();
    const setSelectedId = vi.fn();
    const setSelectedRuleIndex = vi.fn();
    const setDirty = vi.fn();

    const commandsRef = { current: [{ id: 'a', title: 'A', rules: [] as any }] as ReplaceCommand[] };
    const selectedIdRef = { current: 'a' as string | undefined };
    const savedSnapshotRef = { current: null as ReplaceCommand[] | null };
    const pendingAutoSelectIdRef = { current: 'b' as string | undefined };
    const pendingAutoSelectRuleIndexRef = { current: 2 as number | null };
    const pendingAutoSavePayloadRef = { current: [{ id: 'p1', title: 'P', rules: [] as any }] as ReplaceCommand[] | null };
    const autoCreatedRef = { current: false };
    const initialUntitledEnsuredRef = { current: true };
    const draftIdRef = { current: undefined as string | undefined };
    const uiLocaleRef = { current: 'en' as const };

    function Harness(): React.ReactElement {
      useMessageRouter({
        vscodeApi: { postMessage },
        getUntitledTitle: () => 'Untitled command',
        setCommands: () => {},
        setSelectedId,
        setSelectedRuleIndex,
        setDirty,
        commands: commandsRef.current,
        commandsRef: commandsRef as any,
        selectedIdRef: selectedIdRef as any,
        savedSnapshotRef: savedSnapshotRef as any,
        pendingAutoSelectIdRef: pendingAutoSelectIdRef as any,
        pendingAutoSelectRuleIndexRef: pendingAutoSelectRuleIndexRef as any,
        pendingAutoSavePayloadRef: pendingAutoSavePayloadRef as any,
        autoCreatedRef: autoCreatedRef as any,
        initialUntitledEnsuredRef: initialUntitledEnsuredRef as any,
        draftIdRef: draftIdRef as any,
        createDraftCommand,
        uiLocaleRef: uiLocaleRef as any,
      });
      return <div />;
    }

    await TestUtils.act(async () => {
      ReactDOM.render(<Harness />, host);
      await tick();
    });

    expect(setSelectedId).toHaveBeenCalledWith('b');
    expect(setSelectedRuleIndex).toHaveBeenCalled();
    expect(setSelectedRuleIndex.mock.calls.at(-1)?.[0]).toBe(2);
    expect(postMessage).toHaveBeenCalledWith({ type: 'setConfig', payload: [{ id: 'p1', title: 'P', rules: [] as any }] });

    ReactDOM.unmountComponentAtNode(host);
    host.remove();
  });
});

