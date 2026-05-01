import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import * as TestUtils from 'react-dom/test-utils';
import { describe, expect, test, vi } from 'vitest';
import type { ReplaceCommand, ReplaceRule } from '../../src/types';
import { computeResetToSaved, useSnapshotReset } from '../../webview/src/features/app/commands/draftAndSnapshot';

function mkRule(): ReplaceRule {
  return { engine: 'regex', find: 'x', replace: 'y', flags: 'g' } as any;
}

function tick(): Promise<void> {
  return new Promise((r) => window.setTimeout(r, 0));
}

describe('draftAndSnapshot', () => {
  test('computeResetToSaved：快照无未命名命令但当前有时，会补回草稿并尽量保留原 id', () => {
    const snapshot: ReplaceCommand[] = [{ id: 's1', title: 'Saved', rules: [mkRule()] as any }];
    const currentDraft: ReplaceCommand = { id: 'draft1', title: 'Untitled command', rules: [mkRule()] as any };
    const currentCommands: ReplaceCommand[] = [currentDraft, { id: 'cur2', title: 'Other', rules: [mkRule()] as any }];

    const res = computeResetToSaved({
      snapshot,
      currentCommands,
      prevSelectedId: 'draft1',
      prevSelectedRuleIndex: 99,
      untitledTitle: '未命名命令',
      createDraftCommand: (t) => ({ id: 'newDraft', title: t, rules: [mkRule()] as any }),
      createDefaultRule: () => ({ engine: 'regex', find: '', replace: '', flags: 'g' } as any),
    });

    expect(res.nextCommands[0].id).toBe('draft1');
    expect(res.nextCommands[0].title).toBe('未命名命令');
    expect(res.nextSelectedId).toBe('draft1');
    expect(res.nextSelectedRuleIndex).toBe(0);
    expect(res.nextDirty).toBe(false);
    expect(res.restoredUntitledDraft?.id).toBe('draft1');
  });

  test('computeResetToSaved：prevSelectedId 不存在时会创建新的草稿（走 createDraftCommand 分支）', () => {
    const snapshot: ReplaceCommand[] = [{ id: 's1', title: 'Saved', rules: [mkRule()] as any }];
    const currentCommands: ReplaceCommand[] = [{ id: 'u1', title: 'Untitled command', rules: [mkRule()] as any }];

    const res = computeResetToSaved({
      snapshot,
      currentCommands,
      prevSelectedId: 'missing',
      prevSelectedRuleIndex: 0,
      untitledTitle: 'Untitled command',
      createDraftCommand: (t) => ({ id: 'newDraft', title: t, rules: [mkRule()] as any }),
      createDefaultRule: () => ({ engine: 'regex', find: '', replace: '', flags: 'g' } as any),
    });

    expect(res.nextCommands[0].id).toBe('newDraft');
    expect(res.restoredUntitledDraft?.id).toBe('newDraft');
  });

  test('computeResetToSaved：若快照已包含未命名命令，则不额外补草稿', () => {
    const snapshot: ReplaceCommand[] = [
      { id: 'u1', title: 'Untitled command', rules: [mkRule()] as any },
      { id: 's1', title: 'Saved', rules: [mkRule()] as any },
    ];
    const res = computeResetToSaved({
      snapshot,
      currentCommands: snapshot,
      prevSelectedId: 's1',
      prevSelectedRuleIndex: 0,
      untitledTitle: '未命名命令',
      createDraftCommand: (t) => ({ id: 'newDraft', title: t, rules: [mkRule()] as any }),
      createDefaultRule: () => ({ engine: 'regex', find: '', replace: '', flags: 'g' } as any),
    });
    expect(res.nextCommands.map((x) => x.id)).toEqual(['u1', 's1']);
    expect(res.restoredUntitledDraft).toBeUndefined();
  });

  test('useSnapshotReset：会基于快照重置，并在补回草稿时调用 ensureRuleUids 与 testerMatches', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const savedSnapshotRef = { current: [{ id: 's1', title: 'Saved', rules: [mkRule()] as any }] as ReplaceCommand[] };
    const commandsRef = { current: [{ id: 'u1', title: 'Untitled command', rules: [mkRule()] as any }] as ReplaceCommand[] };
    const selectedIdRef = { current: undefined as string | undefined };

    const setCommands = vi.fn();
    const setSelectedId = vi.fn();
    const setSelectedRuleIndex = vi.fn();
    const setDirty = vi.fn();
    const ensureRuleUids = vi.fn();
    const testerMatches = { clearMatches: vi.fn(), scheduleCompute: vi.fn() };

    function Harness(): React.ReactElement {
      const api = useSnapshotReset({
        savedSnapshotRef: savedSnapshotRef as any,
        commandsRef: commandsRef as any,
        selectedIdRef: selectedIdRef as any,
        selectedRuleIndex: 0,
        setCommands,
        setSelectedId,
        setSelectedRuleIndex,
        setDirty,
        ensureRuleUids,
        createDraftCommand: (t) => ({ id: 'newDraft', title: t, rules: [mkRule()] as any }),
        createDefaultRule: () => ({ engine: 'regex', find: '', replace: '', flags: 'g' } as any),
        getUntitledTitle: () => 'Untitled command',
        testerMatches,
      });
      useEffect(() => {
        api.requestResetToSaved();
      }, []);
      return <div />;
    }

    await TestUtils.act(async () => {
      ReactDOM.render(<Harness />, host);
      await tick();
    });

    expect(setCommands).toHaveBeenCalled();
    expect(ensureRuleUids).toHaveBeenCalled();
    expect(testerMatches.clearMatches).toHaveBeenCalled();
    expect(testerMatches.scheduleCompute).toHaveBeenCalled();

    ReactDOM.unmountComponentAtNode(host);
    host.remove();
  });
});

