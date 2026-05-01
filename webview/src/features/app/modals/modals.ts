import { useCallback } from 'react';
import type { ReplaceCommand } from '../../../../../src/types';
import type { LanguageCode } from '../../../i18n';
import type { HookReferrerEntry, HookReferrerRow } from '../../hooks/hookReferrers';
import {
  buildHookReferrerRows,
  collectHookReferrerEntries,
  groupHookReferrerEntriesForModal,
  stripHookIdFromCommands,
  stripHookIdFromReferrerEntries,
} from '../../hooks/hookReferrers';
import { createDraftCommand, createDefaultRule, isUntitledCommandTitle } from '../../../utils';

export type ModalApi = {
  /**
   * 打开“重命名命令”弹窗并返回名称（取消会 throw）。
   *
   * @param cmdId 命令 id。
   * @param initialTitle 初始名称。
   * @param continueSave 是否继续保存。
   * @returns Promise。
   */
  openRenameCommand: (cmdId: string, initialTitle: string, continueSave: boolean) => Promise<void>;
  /**
   * 打开二次确认弹窗，返回是否确认。
   *
   * @param message 文案。
   * @returns 是否确认。
   */
  requestConfirm: (message: string) => Promise<boolean>;
  /**
   * 打开依赖确认弹窗：删除/禁用流程复用。
   *
   * @param data 弹窗入参。
   * @returns 弹窗返回值。
   */
  showHookDepModal: (data: {
    title: string;
    intro: string;
    referrerBlocks: Array<{ commandId: string; commandTitle: string; items: string[] }>;
    referrerRows?: HookReferrerRow[];
    referrerRowCheckboxAria?: string;
    cancelText: string;
    okText: string;
    danger: boolean;
    showRemoveFromOthersCheckbox: boolean;
    removeFromOthersLabel: string;
  }) => Promise<{ ok: boolean; removeFromOthers: boolean; referrerEntriesToStrip: HookReferrerEntry[] }>;
};

export type ToastApi = {
  /**
   * 显示 toast 提示。
   *
   * @param message 文案。
   * @param kind 类型（info/error）。
   * @param durationMs 持续时间（毫秒）。
   * @returns 无返回值。
   */
  show: (message: string, kind?: 'info' | 'error', durationMs?: number) => void;
};

export type UseAppModalsDeps = {
  lang: LanguageCode;
  t: {
    ruleLabel: string;
    cancel: string;
    confirm: string;
    untitledCommand: string;
    hookDepPhasePre: string;
    hookDepPhasePost: string;
    hookDepModalDeleteTitle: string;
    hookDepIntroDelete: string;
    hookDepModalDisableTitle: string;
    hookDepIntroDisableSimple: string;
    hookDepIntroDisableDepsHint: string;
    hookDepRemoveFromOthers: string;
    /** 禁用规则依赖弹窗：每条引用旁复选框的无障碍说明。 */
    hookDepRowCheckboxAria: string;
  };
  modalApi: ModalApi;
  toast: ToastApi;
  commandsRef: React.MutableRefObject<ReplaceCommand[]>;
  selectedIdRef: React.MutableRefObject<string | undefined>;
  selectedRuleIndex: number;
  setCommands: React.Dispatch<React.SetStateAction<ReplaceCommand[]>>;
  setDirty: (dirty: boolean) => void;
  setSelectedRuleIndex: (idx: number) => void;
  pendingAutoSelectIdRef: React.MutableRefObject<string | undefined>;
  scheduleAutoSaveAfterDelete: (nextList: ReplaceCommand[]) => void;
  requestSaveFrom: (list: ReplaceCommand[], options?: { validateNames?: boolean; validateAllCommandNames?: boolean }) => void;
  /**
   * 是否仍处于挂载状态（用于避免卸载后执行 setTimeout 回调触发 setState 警告）。
   */
  isMountedRef?: React.MutableRefObject<boolean>;
};

/**
 * App 级弹窗/确认流程封装：删除命令、禁用规则等需要依赖列表确认的流程。
 *
 * @param deps 依赖注入（state setter、refs、文案、modal/toast）。
 * @returns 可复用的弹窗流程方法。
 */
export function useAppModals(deps: UseAppModalsDeps): {
  confirmDeleteCommandWithDeps: (cmdId: string) => Promise<void>;
  confirmDisableCurrentRule: () => Promise<void>;
  requestRuleEnableButtonClick: (setCurrentRuleEnabled: (enabled: boolean) => void) => Promise<void>;
} {
  const {
    t,
    modalApi,
    commandsRef,
    selectedIdRef,
    selectedRuleIndex,
    setCommands,
    setDirty,
    setSelectedRuleIndex,
    pendingAutoSelectIdRef,
    scheduleAutoSaveAfterDelete,
    requestSaveFrom,
    isMountedRef,
  } = deps;

  const confirmDeleteCommandWithDeps = useCallback(
    async (cmdId: string): Promise<void> => {
      const entries = collectHookReferrerEntries(commandsRef.current, cmdId);
      const blocks = groupHookReferrerEntriesForModal(entries, (n) => `${t.ruleLabel} ${n}`, t.hookDepPhasePre, t.hookDepPhasePost);
      try {
        const res = await modalApi.showHookDepModal({
          title: t.hookDepModalDeleteTitle,
          intro: t.hookDepIntroDelete,
          referrerBlocks: blocks,
          cancelText: t.cancel,
          okText: t.confirm,
          danger: true,
          showRemoveFromOthersCheckbox: false,
          removeFromOthersLabel: '',
        });
        if (!res?.ok) return;
        setCommands((prev) => {
          const stripped = stripHookIdFromCommands(prev, cmdId);
          const next = stripped.filter((x) => x.id !== cmdId);
          const ensured = next.length === 0 ? [createDraftCommand(t.untitledCommand)] : next;
          if ((selectedIdRef.current ?? '') === cmdId) pendingAutoSelectIdRef.current = ensured[0]?.id;
          scheduleAutoSaveAfterDelete(ensured);
          return ensured;
        });
        setDirty(true);
      } catch {
        // 用户取消
      }
    },
    [commandsRef, modalApi, pendingAutoSelectIdRef, scheduleAutoSaveAfterDelete, selectedIdRef, setCommands, setDirty, t],
  );

  const confirmDisableCurrentRule = useCallback(async (): Promise<void> => {
    const selId = selectedIdRef.current;
    const cmd = selId ? commandsRef.current.find((c) => c.id === selId) : undefined;
    const idx = selectedRuleIndex;
    if (!cmd || idx < 0 || !cmd.rules[idx]) return;

    const cmdId = cmd.id;
    const entries = collectHookReferrerEntries(commandsRef.current, cmdId);
    const blocks = groupHookReferrerEntriesForModal(entries, (n) => `${t.ruleLabel} ${n}`, t.hookDepPhasePre, t.hookDepPhasePost);
    const referrerRows = buildHookReferrerRows(entries, (n) => `${t.ruleLabel} ${n}`, t.hookDepPhasePre, t.hookDepPhasePost);
    try {
      const intro = entries.length > 0 ? `${t.hookDepIntroDisableSimple}\n\n${t.hookDepIntroDisableDepsHint}` : t.hookDepIntroDisableSimple;
      const res = await modalApi.showHookDepModal({
        title: t.hookDepModalDisableTitle,
        intro,
        referrerBlocks: blocks,
        referrerRows,
        referrerRowCheckboxAria: t.hookDepRowCheckboxAria,
        cancelText: t.cancel,
        okText: t.confirm,
        danger: false,
        showRemoveFromOthersCheckbox: entries.length > 0,
        removeFromOthersLabel: t.hookDepRemoveFromOthers,
      });
      if (!res?.ok) return;

      let nextList: ReplaceCommand[] | null = null;
      setCommands((prev) => {
        const stripList = res.referrerEntriesToStrip ?? [];
        const base =
          res.removeFromOthers && stripList.length > 0 ? stripHookIdFromReferrerEntries(prev, cmdId, stripList) : prev;
        const next = base.map((c) => {
          if (c.id !== cmdId) return c;
          const rules = [...c.rules];
          const cur = rules[idx];
          if (!cur) return c;
          rules[idx] = { ...cur, enable: false };
          return { ...c, rules };
        });
        nextList = next;
        return next;
      });
      setDirty(true);
      if (nextList) {
        commandsRef.current = nextList;
        window.setTimeout(() => {
          if (isMountedRef && !isMountedRef.current) return;
          requestSaveFrom(nextList as ReplaceCommand[], { validateNames: false });
        }, 0);
      }
    } catch {
      // 用户取消
    }
  }, [commandsRef, isMountedRef, modalApi, requestSaveFrom, selectedIdRef, selectedRuleIndex, setCommands, setDirty, t]);

  const requestRuleEnableButtonClick = useCallback(
    async (setCurrentRuleEnabled: (enabled: boolean) => void): Promise<void> => {
      const selId = selectedIdRef.current;
      const cmd = selId ? commandsRef.current.find((c) => c.id === selId) : undefined;
      if (!cmd || !cmd.rules[selectedRuleIndex]) return;
      const rule = cmd.rules[selectedRuleIndex];
      const isEnabled = rule.enable !== false;
      if (!isEnabled) {
        setCurrentRuleEnabled(true);
        return;
      }
      await confirmDisableCurrentRule();
    },
    [commandsRef, confirmDisableCurrentRule, selectedIdRef, selectedRuleIndex],
  );

  return { confirmDeleteCommandWithDeps, confirmDisableCurrentRule, requestRuleEnableButtonClick };
}

