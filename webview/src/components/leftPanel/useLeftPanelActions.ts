import { useCallback, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import type { ReplaceCommand } from '../../../../src/types';
import { buildPayloadFromList } from '../../features/commands/saveUtils';
import { createCommandId, isPristineUntitledDraft, isUntitledCommandTitle } from '../../utils';
import type { createVscodeApi } from '../../bridge/vscodeApi';
import type { I18nMessages } from '../../i18n';

export type UseLeftPanelActionsOptions = {
  commands: ReplaceCommand[];
  setCommands: React.Dispatch<React.SetStateAction<ReplaceCommand[]>>;
  setSelectedId: (id: string | undefined) => void;
  setSelectedRuleIndex: (i: number) => void;
  setDirty: (d: boolean) => void;
  setSearch: (s: string) => void;
  search: string;
  vscodeApi: ReturnType<typeof createVscodeApi>;
  t: I18nMessages;
  filtered: ReplaceCommand[];
  hasAnyUntitledCommand: boolean;
  selectedId?: string;
  selectedIdRef: MutableRefObject<string | undefined>;
  selectedRuleIndex: number;
  pendingAutoSelectIdRef: MutableRefObject<string | undefined>;
  createDraftCommand: (title: string) => ReplaceCommand;
  createDefaultRule: () => import('../../../../src/types').ReplaceRule;
  scheduleAutoSaveAfterDelete: (list: ReplaceCommand[]) => void;
  onOpenRename: (cmdId: string, initialTitle: string, continueSave: boolean) => void | Promise<void>;
  isCommandDeletable: (cmd: ReplaceCommand) => boolean;
  isCommandDirty: (cmd: ReplaceCommand) => boolean;
  isRuleDirty: (cmd: ReplaceCommand, ruleIndex: number) => boolean;
};

/**
 * 聚合左侧命令列表的交互逻辑，供 LeftPanel 作为 props 一次性下发。
 *
 * @param opt 依赖的命令状态与回调。
 * @returns LeftPanel 所需的 props 子集。
 */
export function useLeftPanelActions(opt: UseLeftPanelActionsOptions) {
  const {
    commands,
    setCommands,
    setSelectedId,
    setSelectedRuleIndex,
    setDirty,
    setSearch,
    vscodeApi,
    t,
    filtered,
    hasAnyUntitledCommand,
    selectedId: selectedIdState,
    selectedIdRef,
    selectedRuleIndex,
    pendingAutoSelectIdRef,
    createDraftCommand,
    createDefaultRule,
    scheduleAutoSaveAfterDelete,
    onOpenRename,
    isCommandDeletable,
    isCommandDirty,
    isRuleDirty,
  } = opt;

  const onChangeSearch = useCallback((value: string) => setSearch(value), [setSearch]);

  const onClickNewCommand = useCallback(() => {
    const existingUntitled = commands.find((c) => isUntitledCommandTitle(c.title));
    if (existingUntitled) {
      setSelectedId(existingUntitled.id);
      setSelectedRuleIndex(0);
      return;
    }
    const id = createCommandId();
    const newCmd: ReplaceCommand = {
      id,
      title: t.untitledCommand,
      rules: [{ engine: 'regex', find: '', replace: '', flags: 'g' }],
    };
    setCommands((prev) => [newCmd, ...prev]);
    setSelectedId(id);
    setSelectedRuleIndex(0);
    setDirty(true);
  }, [commands, setCommands, setSelectedId, setSelectedRuleIndex, setDirty, t.untitledCommand]);

  const onClickExport = useCallback(() => {
    const payload = buildPayloadFromList(commands, isPristineUntitledDraft);
    vscodeApi.postMessage({ type: 'exportCommands', payload });
  }, [commands, vscodeApi]);

  const onClickImport = useCallback(() => {
    vscodeApi.postMessage({ type: 'importCommands' });
  }, [vscodeApi]);

  const onSelectCommand = useCallback(
    (cmdId: string) => {
      setSelectedId(cmdId);
      setSelectedRuleIndex(0);
    },
    [setSelectedId, setSelectedRuleIndex],
  );

  const onSelectRule = useCallback(
    (ruleIndex: number) => {
      setSelectedRuleIndex(ruleIndex);
    },
    [setSelectedRuleIndex],
  );

  const onRenameCommand = useCallback(
    (cmdId: string, currentTitle: string) => {
      // 命令重命名属于配置变更：确认后应直接触发一次保存，避免用户再手动点击保存按钮。
      onOpenRename(cmdId, currentTitle, true);
    },
    [onOpenRename],
  );

  const onDeleteCommand = useCallback(
    (cmdId: string) => {
      setCommands((prev) => {
        const next = prev.filter((x) => x.id !== cmdId);
        const ensured = next.length === 0 ? [createDraftCommand(t.untitledCommand)] : next;
        if ((selectedIdRef.current ?? '') === cmdId) pendingAutoSelectIdRef.current = ensured[0]?.id;
        scheduleAutoSaveAfterDelete(ensured);
        return ensured;
      });
      setDirty(true);
    },
    [createDraftCommand, pendingAutoSelectIdRef, scheduleAutoSaveAfterDelete, selectedIdRef, setCommands, setDirty, t.untitledCommand],
  );

  const onDeleteRule = useCallback(
    (cmdId: string, ruleIndex: number) => {
      setSelectedRuleIndex(0);
      setCommands((prev) => {
        const next = prev.map((cmd) => {
          if (cmd.id !== cmdId) return cmd;
          const nextRules = cmd.rules.filter((_, i) => i !== ruleIndex);
          return { ...cmd, rules: nextRules.length > 0 ? nextRules : [createDefaultRule()] };
        });
        scheduleAutoSaveAfterDelete(next);
        return next;
      });
      setDirty(true);
    },
    [createDefaultRule, scheduleAutoSaveAfterDelete, setCommands, setDirty, setSelectedRuleIndex],
  );

  const tPanel = useMemo(
    () => ({
      searchPlaceholder: t.searchPlaceholder,
      commandListTitle: t.commandListTitle,
      newCommand: t.newCommand,
      export: t.export,
      import: t.import,
      ruleLabel: t.ruleLabel,
      enabled: t.ruleEnabled,
      disabled: t.ruleDisabled,
      renameCommand: t.renameCommand,
      deleteCommand: t.deleteCommand,
      deleteRule: t.deleteRule,
      confirmDeleteCommand: t.confirmDeleteCommand,
      confirmDeleteRule: t.confirmDeleteRule,
    }),
    [t],
  );

  return {
    t: tPanel,
    commands,
    filtered,
    search: opt.search,
    selectedId: selectedIdState,
    selectedRuleIndex,
    isUntitledCommandTitle,
    isCommandDeletable,
    isCommandDirty,
    isRuleDirty,
    onChangeSearch,
    onClickNewCommand,
    onClickExport,
    onClickImport,
    isNewCommandDisabled: hasAnyUntitledCommand,
    newCommandDisabledTitle: t.newCommandDisabledReason,
    onSelectCommand,
    onSelectRule,
    onRenameCommand,
    onDeleteCommand,
    onDeleteRule,
  };
}
