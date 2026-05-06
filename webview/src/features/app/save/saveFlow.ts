import { useCallback } from 'react';
import type { ReplaceCommand, ReplaceRule } from '../../../../../src/types';
import { buildPayloadFromList, isSavableRule, validateCommandName, validateRuleTitle } from '../../commands/saveUtils';
import type { LanguageCode } from '../../../i18n';
import { isPristineUntitledDraft, isUntitledCommandTitle } from '../../../utils';

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

export type SaveFlowMessages = {
  nameRequired: string;
  nameDuplicate: string;
  nameReservedChars: string;
  ruleTitleReservedChars: string;
  ruleLabel: string;
  addRuleFirst: string;
  confirm: string;
  cancel: string;
  addRuleFirstInfo?: string;
  mapOnlyRegex?: string;
  mapEmpty?: string;
  mapMatchRequired?: string;
  mapItemRegexInvalid?: string;
};

export type SaveFlowDeps = {
  /**
   * 读取当前语言（用于错误文案中英文拼接）。
   */
  lang: LanguageCode;
  /**
   * 保存/校验所需文案。
   */
  t: SaveFlowMessages;
  /**
   * Toast API（可注入 mock）。
   */
  toast: ToastApi;
};

export type SaveFromOptions = {
  /**
   * 是否执行名称校验（用于区分用户主动保存与自动保存）。默认 true。
   */
  validateNames?: boolean;
  /**
   * 为 true 时对 willSave 中全部命令做名称/规则标题校验；
   * 默认 false：仅校验当前选中命令（避免侧栏其他草稿的命名问题阻塞本次保存）。
   */
  validateAllCommandNames?: boolean;
};

/**
 * 从命令列表构建真实落盘 payload（过滤空白草稿等）。
 *
 * @param list 命令列表（UI state）。
 * @returns 将要落盘的 payload。
 */
export function buildSavePayload(list: ReplaceCommand[]): ReplaceCommand[] {
  return buildPayloadFromList(list, isPristineUntitledDraft);
}

/**
 * 校验映射模式规则是否合法：仅支持 regex 引擎，且映射表 cases 至少包含 1 条规则。
 *
 * @param payload 将要写入配置的命令列表。
 * @param deps 依赖（文案、语言、toast）。
 * @returns 是否通过校验。
 */
export function validateMapRulesBeforeSave(payload: ReplaceCommand[], deps: SaveFlowDeps): boolean {
  const { t, toast, lang } = deps;
  for (const cmd of payload) {
    for (const rule of cmd.rules) {
      const mode = (rule as any)?.replaceMode ?? 'template';
      if (mode !== 'map') continue;
      if (rule.engine !== 'regex') {
        toast.show(t.mapOnlyRegex ?? '映射模式仅支持 regex 引擎。', 'error');
        return false;
      }
      const m = (rule as any)?.map as { mode?: 'text' | 'regex'; cases?: Array<{ find: string; replace: string }> } | undefined;
      const cases = m?.cases ?? [];
      if (!Array.isArray(cases) || cases.length === 0) {
        toast.show(t.mapEmpty ?? '映射表不能为空，请至少添加 1 条规则。', 'error');
        return false;
      }
      for (const it of cases) {
        if (String(it?.find ?? '').trim() === '') {
          toast.show(
            t.mapMatchRequired ?? (lang === 'zh-CN' ? '映射表每一行的「匹配」不能为空。' : 'Each mapping row must have a non-empty Match value.'),
            'error',
          );
          return false;
        }
      }
      if (m?.mode === 'regex') {
        try {
          for (const it of cases) {
            const src = String(it?.find ?? '').trim();
            RegExp(src, 'g');
          }
        } catch (e) {
          const raw = e instanceof Error ? e.message : String(e);
          toast.show(t.mapItemRegexInvalid ?? `映射表中的正则表达式不合法：${raw}`, 'error');
          return false;
        }
      }
    }
  }
  return true;
}

/**
 * 校验将要保存的规则表达式是否合法：regex 引擎要求 find + flags 可被 RegExp 正常编译。
 *
 * @param payload 将要写入配置的命令列表。
 * @param deps 依赖（文案、语言、toast）。
 * @returns 是否通过校验。
 */
export function validateRuleExpressionsBeforeSave(payload: ReplaceCommand[], deps: SaveFlowDeps): boolean {
  const { t, lang, toast } = deps;
  for (const cmd of payload) {
    for (let i = 0; i < cmd.rules.length; i += 1) {
      const rule = cmd.rules[i];
      if (!rule || rule.engine !== 'regex') continue;
      try {
        new RegExp(rule.find ?? '', rule.flags ?? 'g');
      } catch (e) {
        const ruleTitle = (rule as any)?.title ? String((rule as any).title) : `${t.ruleLabel} ${i + 1}`;
        const raw = e instanceof Error ? e.message : String(e);
        const msg =
          lang === 'zh-CN'
            ? `请先修正表达式后再保存：${cmd.title} / ${ruleTitle}，${raw}`
            : `Please fix regex before saving: ${cmd.title} / ${ruleTitle}, ${raw}`;
        toast.show(msg, 'error');
        return false;
      }
    }
  }
  return true;
}

/**
 * 保存前名称校验：命令名/规则标题不允许为空、重复或包含保留字符。
 *
 * @param willSave 将要保存的命令列表（已过滤草稿）。
 * @param deps 依赖（文案、语言、toast）。
 * @param onlyForCommandId 若传入非空字符串，则仅校验该 id 对应的一条命令（用于保存当前命令时不被列表中其他命令的命名问题误伤）；缺省时校验全部命令。
 * @returns 是否通过校验。
 */
export function validateNamesBeforeSave(
  willSave: ReplaceCommand[],
  deps: SaveFlowDeps,
  onlyForCommandId?: string,
): boolean {
  const { t, lang, toast } = deps;
  const toScan =
    onlyForCommandId && onlyForCommandId.trim() !== ''
      ? willSave.filter((c) => c.id === onlyForCommandId)
      : willSave;
  for (const cmd of toScan) {
    const cmdTitle = String(cmd.title ?? '');
    const cmdErr = validateCommandName(willSave, cmdTitle, String(cmd.id ?? ''), {
      nameRequired: t.nameRequired,
      nameDuplicate: t.nameDuplicate,
      nameReservedChars: t.nameReservedChars,
    });
    if (cmdErr) {
      toast.show(cmdErr, 'error');
      return false;
    }
    for (let i = 0; i < (cmd.rules?.length ?? 0); i += 1) {
      const r = cmd.rules[i] as any;
      const title = typeof r?.title === 'string' ? r.title : '';
      const err = validateRuleTitle(title, t.ruleTitleReservedChars);
      if (err) {
        const ruleLabel = title.trim() ? title.trim() : `${t.ruleLabel} ${i + 1}`;
        const msg = lang === 'zh-CN' ? `${err}（${cmd.title} / ${ruleLabel}）` : `${err} (${cmd.title} / ${ruleLabel})`;
        toast.show(msg, 'error');
        return false;
      }
    }
  }
  return true;
}

/**
 * 查找是否存在“未命名命令”（需要在保存前强制重命名）。
 *
 * @param willSave 将要保存的命令列表。
 * @returns 未命名命令对象；不存在则返回 undefined。
 */
export function findFirstUntitledCommand(willSave: ReplaceCommand[]): ReplaceCommand | undefined {
  return willSave.find((c) => isUntitledCommandTitle(c.title));
}

export type UseSaveFlowDeps = SaveFlowDeps & {
  /**
   * 当前 UI state 的命令列表。
   */
  commands: ReplaceCommand[];
  /**
   * 读写 commands state。
   */
  setCommands: (next: ReplaceCommand[]) => void;
  /**
   * 标记 dirty。
   */
  setDirty: (dirty: boolean) => void;
  /**
   * 当前选中命令 id。
   */
  selectedId: string | undefined;
  /**
   * selectedId 的 ref（避免异步回调读取旧值）。
   */
  selectedIdRef: React.MutableRefObject<string | undefined>;
  /**
   * 当前选中规则索引。
   */
  selectedRuleIndex: number;
  /**
   * 更新选中规则索引。
   */
  setSelectedRuleIndex: (idx: number) => void;
  /**
   * 当前命令列表的 ref（避免回包时读取旧列表）。
   */
  commandsRef: React.MutableRefObject<ReplaceCommand[]>;
  /**
   * 保存后快照 ref（用于 reset/仅保存顺序等流程）。
   */
  savedSnapshotRef: React.MutableRefObject<ReplaceCommand[] | null>;
  /**
   * vscodeApi：用于落盘保存。
   */
  vscodeApi: { postMessage: (msg: any) => void };
  /**
   * 打开重命名弹窗（由上层注入，以复用 modal 流程）。
   */
  openRenameCommand: (cmdId: string, initialTitle: string, continueSave: boolean) => Promise<void>;
};

/**
 * 保存流程 hook：聚合保存前校验、未命名命令重命名、以及落盘保存。
 *
 * @param deps 依赖注入（state、文案、toast、vscodeApi 等）。
 * @returns 保存相关方法。
 */
export function useSaveFlow(deps: UseSaveFlowDeps): {
  requestSaveFrom: (list: ReplaceCommand[], options?: SaveFromOptions) => void;
  requestSave: () => void;
  doSaveFrom: (list: ReplaceCommand[]) => void;
} {
  const {
    commands,
    setCommands,
    setDirty,
    selectedIdRef,
    selectedRuleIndex,
    setSelectedRuleIndex,
    commandsRef,
    savedSnapshotRef,
    vscodeApi,
    openRenameCommand,
    ...rest
  } = deps;

  const doSaveFrom = useCallback(
    (list: ReplaceCommand[]): void => {
      const payload = buildSavePayload(list);
      if (!validateMapRulesBeforeSave(payload, { ...rest, lang: deps.lang })) return;
      if (!validateRuleExpressionsBeforeSave(payload, { ...rest, lang: deps.lang })) return;

      const currentCmd = list.find((c) => c.id === (selectedIdRef.current ?? ''));
      if (currentCmd) {
        const hasSavableRule = currentCmd.rules.some((r) => isSavableRule(r));
        if (!hasSavableRule) {
          rest.toast.show(rest.t.addRuleFirst, 'info');
          return;
        }

        // 当前规则为空（表达式为空且前/后置均为空）时，不允许保存，避免“误保存到别的规则”。
        const currentRuleSavable = currentCmd.rules[selectedRuleIndex]
          ? isSavableRule(currentCmd.rules[selectedRuleIndex])
          : false;
        if (!currentRuleSavable) {
          rest.toast.show(rest.t.addRuleFirst, 'info');
          return;
        }
      }

      vscodeApi.postMessage({ type: 'setConfig', payload });
      setDirty(false);
      savedSnapshotRef.current = structuredClone(payload) as ReplaceCommand[];

      // 未命名/空白草稿可能不在 payload 中（不落盘或暂无可保存规则），但仍应留在侧栏；仅用 payload 覆盖会丢，且 config 回包时无法从 ref 恢复。
      const untitledKept = list.filter(
        (c) =>
          !payload.some((p) => p.id === c.id) &&
          (isPristineUntitledDraft(c) || isUntitledCommandTitle(c.title)),
      );
      if (untitledKept.length > 0) {
        const deduped = [...untitledKept, ...payload];
        setCommands(deduped);
        commandsRef.current = deduped;
        // 选中 id 由 App 编排层负责；此处仅将规则索引归零。
        setSelectedRuleIndex(0);
      }
    },
    [commandsRef, deps.lang, openRenameCommand, rest, savedSnapshotRef, selectedIdRef, selectedRuleIndex, setCommands, setDirty, setSelectedRuleIndex, vscodeApi],
  );

  const requestSaveFrom = useCallback(
    (list: ReplaceCommand[], options?: SaveFromOptions): void => {
      const willSave = buildSavePayload(list);
      const shouldValidateNames = options?.validateNames !== false;
      if (shouldValidateNames) {
        const scopeAll = options?.validateAllCommandNames === true;
        const onlyId = scopeAll ? undefined : (selectedIdRef.current ?? undefined);
        if (!validateNamesBeforeSave(willSave, rest as SaveFlowDeps, onlyId)) return;
      }
      const untitled = findFirstUntitledCommand(willSave);
      if (untitled) {
        void openRenameCommand(untitled.id, '', true);
        return;
      }
      doSaveFrom(list);
    },
    [doSaveFrom, openRenameCommand, rest],
  );

  const requestSave = useCallback((): void => {
    requestSaveFrom(commands);
  }, [commands, requestSaveFrom]);

  return { requestSaveFrom, requestSave, doSaveFrom };
}

