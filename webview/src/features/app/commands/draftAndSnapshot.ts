import { useCallback } from 'react';
import type { ReplaceCommand, ReplaceRule } from '../../../../../../src/types';
import { isUntitledCommandTitle } from '../../../utils';

export type ResetComputationInput = {
  /**
   * 已保存快照（从 settings 回包得到的最后一次保存结果）。
   */
  snapshot: ReplaceCommand[];
  /**
   * 当前 UI state 的命令列表（用于判断是否需要补回未命名草稿，以及复用其 id）。
   */
  currentCommands: ReplaceCommand[];
  /**
   * reset 前的选中命令 id。
   */
  prevSelectedId: string | undefined;
  /**
   * reset 前的选中规则索引。
   */
  prevSelectedRuleIndex: number;
  /**
   * 未命名草稿的默认标题（来自 i18n）。
   */
  untitledTitle: string;
  /**
   * 创建空白草稿命令的工厂函数。
   */
  createDraftCommand: (untitledTitle: string) => ReplaceCommand;
  /**
   * 创建默认规则的工厂函数。
   */
  createDefaultRule: () => ReplaceRule;
};

export type ResetComputationResult = {
  /**
   * reset 后的命令列表。
   */
  nextCommands: ReplaceCommand[];
  /**
   * reset 后应选中的命令 id。
   */
  nextSelectedId: string | undefined;
  /**
   * reset 后应选中的规则索引（已裁剪）。
   */
  nextSelectedRuleIndex: number;
  /**
   * reset 是否应把 dirty 置为 false。
   */
  nextDirty: boolean;
  /**
   * reset 后是否需要补回未命名草稿（用于上层补 UID 等副作用）。
   */
  restoredUntitledDraft: ReplaceCommand | undefined;
};

/**
 * 计算“重置到已保存快照”后的下一状态：基于快照恢复命令列表，并在需要时补回未命名草稿，
 * 同时计算恢复后的选中命令与规则索引裁剪结果。
 *
 * @param input 计算输入。
 * @returns reset 计算结果。
 */
export function computeResetToSaved(input: ResetComputationInput): ResetComputationResult {
  const { snapshot, currentCommands, prevSelectedId, prevSelectedRuleIndex, untitledTitle, createDraftCommand, createDefaultRule } = input;

  const next = structuredClone(snapshot) as ReplaceCommand[];

  const hasCurrentUntitled = currentCommands.some((c) => isUntitledCommandTitle(c.title));
  const snapHasUntitled = next.some((c) => isUntitledCommandTitle(c.title));
  const shouldRestoreUntitledDraft = hasCurrentUntitled && !snapHasUntitled;

  let restoredUntitledDraft: ReplaceCommand | undefined;
  if (shouldRestoreUntitledDraft) {
    const currentUntitledCmd = prevSelectedId
      ? currentCommands.find((c) => c.id === prevSelectedId)
      : currentCommands.find((c) => isUntitledCommandTitle(c.title));

    restoredUntitledDraft = currentUntitledCmd
      ? {
          ...currentUntitledCmd,
          title: untitledTitle,
          description: undefined,
          rules: [createDefaultRule()],
        }
      : createDraftCommand(untitledTitle);

    next.unshift(restoredUntitledDraft);
  }

  const prevSelectedCmd = prevSelectedId ? currentCommands.find((c) => c.id === prevSelectedId) : undefined;
  const prevSelectedIsUntitled = prevSelectedCmd ? isUntitledCommandTitle(prevSelectedCmd.title) : false;

  const nextCmd = prevSelectedId ? next.find((c) => c.id === prevSelectedId) : undefined;
  const fallbackCmd = next[0];
  const finalCmd = nextCmd ?? (prevSelectedIsUntitled ? restoredUntitledDraft : undefined) ?? fallbackCmd;

  const nextSelectedId = finalCmd?.id;
  const maxIdx = finalCmd ? Math.max(0, (finalCmd.rules?.length ?? 1) - 1) : 0;
  const nextSelectedRuleIndex = Math.min(prevSelectedRuleIndex, maxIdx);

  return {
    nextCommands: next,
    nextSelectedId,
    nextSelectedRuleIndex,
    nextDirty: false,
    restoredUntitledDraft,
  };
}

export type UseSnapshotResetDeps = {
  /**
   * 已保存快照 ref。
   */
  savedSnapshotRef: React.MutableRefObject<ReplaceCommand[] | null>;
  /**
   * 当前命令列表 ref（用于复用未命名草稿 id）。
   */
  commandsRef: React.MutableRefObject<ReplaceCommand[]>;
  /**
   * 当前选中命令 id ref。
   */
  selectedIdRef: React.MutableRefObject<string | undefined>;
  /**
   * 当前选中规则索引。
   */
  selectedRuleIndex: number;
  /**
   * state setters。
   */
  setCommands: (next: ReplaceCommand[]) => void;
  setSelectedId: (id: string) => void;
  setSelectedRuleIndex: (idx: number) => void;
  setDirty: (dirty: boolean) => void;
  /**
   * reset 后需要补齐 ruleUid 的副作用（保留原未命名命令 id 时尤其重要）。
   */
  ensureRuleUids: (cmdId: string, rulesLen: number) => void;
  /**
   * 创建草稿与默认规则的工厂函数。
   */
  createDraftCommand: (untitledTitle: string) => ReplaceCommand;
  createDefaultRule: () => ReplaceRule;
  /**
   * i18n：未命名命令标题（从 ref 获取，避免闭包读取旧值）。
   */
  getUntitledTitle: () => string;
  /**
   * testerMatches：重置后刷新匹配结果。
   */
  testerMatches: { clearMatches: () => void; scheduleCompute: () => void };
};

/**
 * reset hook：将 UI state 重置为已保存快照，并处理未命名草稿补回、选择裁剪与 tester 结果刷新。
 *
 * @param deps 依赖注入（refs、setters、工厂函数、testerMatches）。
 * @returns reset 方法。
 */
export function useSnapshotReset(deps: UseSnapshotResetDeps): { requestResetToSaved: () => void } {
  const {
    savedSnapshotRef,
    commandsRef,
    selectedIdRef,
    selectedRuleIndex,
    setCommands,
    setSelectedId,
    setSelectedRuleIndex,
    setDirty,
    ensureRuleUids,
    createDraftCommand,
    createDefaultRule,
    getUntitledTitle,
    testerMatches,
  } = deps;

  const requestResetToSaved = useCallback((): void => {
    const snap = savedSnapshotRef.current;
    if (!snap || !snap.length) return;

    const res = computeResetToSaved({
      snapshot: snap,
      currentCommands: commandsRef.current,
      prevSelectedId: selectedIdRef.current,
      prevSelectedRuleIndex: selectedRuleIndex,
      untitledTitle: getUntitledTitle(),
      createDraftCommand,
      createDefaultRule,
    });

    if (res.restoredUntitledDraft) {
      ensureRuleUids(res.restoredUntitledDraft.id, res.restoredUntitledDraft.rules.length);
    }

    setCommands(res.nextCommands);
    if (res.nextSelectedId) setSelectedId(res.nextSelectedId);
    setSelectedRuleIndex(res.nextSelectedRuleIndex);
    setDirty(res.nextDirty);

    testerMatches.clearMatches();
    testerMatches.scheduleCompute();
  }, [
    commandsRef,
    createDefaultRule,
    createDraftCommand,
    ensureRuleUids,
    getUntitledTitle,
    savedSnapshotRef,
    selectedIdRef,
    selectedRuleIndex,
    setCommands,
    setDirty,
    setSelectedId,
    setSelectedRuleIndex,
    testerMatches,
  ]);

  return { requestResetToSaved };
}

