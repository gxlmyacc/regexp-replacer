import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorView } from '@codemirror/view';
import { createVscodeApi } from './bridge/vscodeApi';
import { type ReplaceRule as TesterReplaceRule } from './features/tester/matchHighlighter';
import { computeReplacePreview } from './features/tools/replacePreview';
import { getHookOptions, getSelectedRuleHooks, wouldCreateLoop, type HookPhase } from './features/hooks/hookUtils';
import { buildPayloadFromList, validateCommandName, validateRuleTitle } from './features/commands/saveUtils';
import type { LanguageCode } from './i18n';
import { useI18n } from './i18n/I18nProvider';
import { LeftPanel } from './components/LeftPanel';
import { HookChipsBar } from './components/HookChipsBar';
import { CodeMirrorTextEditor } from './components/CodeMirrorTextEditor';
import { ReplaceResultBox } from './components/ReplaceResultBox';
import { ListResultPanel } from './components/ListResultPanel';
import { RuleTitleEditor } from './components/RuleTitleEditor';
import { ExplainTabContent } from './components/ExplainTabContent';
import { MatchDetailsPanel } from './components/MatchDetailsPanel';
import { ReplacementTemplateField } from './components/ReplacementTemplateField';
import { RuleExpressionField } from './components/RuleExpressionField';
import {
  Checkbox,
  Tooltip,
  Switch,
  DropdownMenu,
  ConfirmModal,
  HookDependencyConfirmModal,
  Splitter,
  Layout,
  Icon,
  Button,
} from './components/base';
import { TabBar } from './components/base';
import { MappingTable } from './components/MappingTable';
import { RenameCommandModal } from './components/RenameCommandModal';
import { showRefModal } from 'use-modal-ref';
import { useLeftPanelActions } from './components/leftPanel/useLeftPanelActions';
import { attachHorizontalSplitDrag, attachVerticalSplitDrag } from './hooks/paneSplitDrag';
import {
  buildRuleKey,
  createDraftCommand,
  createDefaultRule,
  createCommandId,
  createRuleUid,
  isPristineUntitledDraft,
  isUntitledCommandTitle,
  normalizeCommandTitles,
  tokenizeRegexPattern,
} from './utils';
import { copyTextToClipboard } from './utils/clipboard';
import { countCapturingGroups } from './utils/regexLint/countCapturingGroups';
import { fetchAndSanitizeDevSeedCommands, mergeDevSeedDisplayFields } from './utils/devSeedRelocale';
import { Toast } from './components/base';
import type { ToolsTab } from './hooks/useRuleUiCache';
import { useRuleUiCache } from './hooks/useRuleUiCache';
import { useTesterMatchesCm } from './hooks/useTesterMatchesCm';
import { useSaveFlow } from './features/app/save/saveFlow';
import { useAppModals } from './features/app/modals/modals';
import { useSnapshotReset } from './features/app/commands/draftAndSnapshot';
import { useCommandSelection } from './features/app/commands/selection';
import { useMessageRouter } from './features/app/messages/messageRouter';
import { useLayoutPersistence } from './features/app/layout/layoutPersistence';
import { computeReorderPayloadFromSnapshot, computeReorderedCommands } from './features/app/reorder/reorderCommands';
import type { ReplaceCommand, ReplaceRule } from '../../src/types';
import { applyRule } from '../../src/replace/engines';
import { HookLoopError, runHookChainOnText } from '../../src/replace/textChain';
import './App.scss';

/**
 * RegExp UI 页面主组件。
 *
 * @returns React 元素。
 */
export function App(): React.ReactElement {
  const vscodeApi = useMemo(() => createVscodeApi(), []);
  const { lang, setLang, t } = useI18n();
  /** 供 config 回包解析双语种子数据时读取当前界面语言。 */
  const uiLocaleRef = useRef(lang);
  uiLocaleRef.current = lang;
  const tRef = useRef(t);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * 生成并保持一个稳定的“初始未命名命令 id”，用于首次渲染时立刻展示草稿。
   *
   * @returns 初始草稿命令 id。
   */
  const initialDraftId = useMemo(() => createCommandId(), []);

  /**
   * Webview 布局状态（可拖拽分割线调整）。
   */
  type LayoutState = {
    leftWidth: number;
    toolsHeight: number;
    toolsSplitLeftWidth: number;
  };

  /**
   * 从 Webview state 读取布局配置（不存在则使用默认值）。
   *
   * @returns 布局状态。
   */
  function getInitialLayoutState(): LayoutState {
    return {
      leftWidth: 220,
      toolsHeight: 280,
      toolsSplitLeftWidth: 320,
    };
  }

  const [layout, setLayout] = useState<LayoutState>(() => getInitialLayoutState());
  const { leftCollapsed, showSplitterToggleArrow, setLeftCollapsedAndPersist } = useLayoutPersistence();

  const [commands, setCommands] = useState<ReplaceCommand[]>(() => [
    {
      id: initialDraftId,
      title: t.untitledCommand,
      rules: [{ engine: 'regex', find: '', replace: '', flags: 'g' }],
    },
  ]);
  const commandsRef = useRef<ReplaceCommand[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(() => initialDraftId);
  const pendingAutoSavePayloadRef = useRef<ReplaceCommand[] | null>(null);

  const [selectedRuleIndex, setSelectedRuleIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [replacePreview, setReplacePreview] = useState<
    { count: number; text: string; parts: { text: string; replaced: boolean }[]; finalText: string } | undefined
  >(undefined);
  /** 替换页是否高亮「被替换」片段；默认关闭以减少预览分段分配。 */
  const [replacePreviewHighlight, setReplacePreviewHighlight] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);

  const testEditorRef = useRef<EditorView | null>(null);
  const [isTestEditorReady, setIsTestEditorReady] = useState(false);
  const autoCreatedRef = useRef(false);
  const savedSnapshotRef = useRef<ReplaceCommand[] | null>(null);
  const draftIdRef = useRef<string | undefined>(undefined);
  const initialUntitledEnsuredRef = useRef(false);

  const appHostRef = useRef<HTMLDivElement | null>(null);
  const onRestoreRef = useRef<(() => void) | null>(null);

    /**
   * 提交一次命令重命名，并继续执行保存流程（会再次检查是否仍存在未命名命令）。
   *
   * @param cmdId 命令 id。
   * @param name 新命令名称（未 trim）。
   * @param continueSave 是否继续触发保存流程。
   * @returns 无返回值。
   */
    function commitRenameAndContinueSave(cmdId: string, name: string, continueSave: boolean): void {
      if (!isMountedRef.current) return;
      const nextName = name.trim();
      const nextList = commands.map((c) => (c.id === cmdId ? { ...c, title: nextName } : c));
      setCommands(nextList);
      // 立即同步 ref，避免 config 回包读取到旧草稿并错误保留。
      commandsRef.current = nextList;
      setSelectedId(cmdId);
      setDirty(true);
      if (continueSave) {
        window.setTimeout(() => {
          if (!isMountedRef.current) return;
          requestSaveFrom(nextList);
        }, 0);
      }
    }
    
  /**
   * 打开“重命名命令”弹窗：成功返回名称并写回命令；取消则不变更。
   *
   * @param cmdId 命令 id。
   * @param initialTitle 初始名称。
   * @param continueSave 是否继续触发保存流程。
   * @returns 无返回值。
   */
  async function openRenameCommand(cmdId: string, initialTitle: string, continueSave: boolean): Promise<void> {
    const validate = (name: string): string | undefined =>
      validateCommandName(commandsRef.current, name, cmdId, {
        nameRequired: t.nameRequired,
        nameDuplicate: t.nameDuplicate,
        nameReservedChars: (t as any).nameReservedChars ?? '名称中不允许包含保留字符：<>[]',
      });
    try {
      const nextName = await showRefModal(
        RenameCommandModal,
        {
          title: t.renameCommandTitle,
          initialValue: initialTitle ?? '',
          placeholder: t.commandNamePlaceholder,
          cancelText: t.cancel,
          okText: t.confirm,
          validateName: validate,
        },
      );
      if (!isMountedRef.current) return;
      commitRenameAndContinueSave(cmdId, nextName, continueSave);
    } catch {
      // cancel
    }
  }

  /**
   * 打开“二次确认”弹窗，返回用户是否确认。
   *
   * @param message 确认提示文案。
   * @returns 用户点击“确定”为 true，否则为 false。
   */
  async function requestConfirm(message: string): Promise<boolean> {
    try {
      const ok = await showRefModal(ConfirmModal, {
        title: t.confirm,
        content: message,
        cancelText: t.cancel,
        okText: t.confirm,
        danger: true,
      });
      return Boolean(ok);
    } catch {
      return false;
    }
  }

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  /**
   * 获取当前语言下的“未命名命令”标题（稳定引用，避免下游 effect 因函数 identity 变化而重复执行）。
   *
   * 无入参。
   *
   * @returns 未命名命令标题。
   */
  const getUntitledTitle = useCallback((): string => tRef.current.untitledCommand, []);

  // 注意：不要使用 webview 的 setState/getState 做持久化。
  // 在 Cursor 中它会写入全局 local storage（state.vscdb），频繁写入可能导致存储异常。

  useEffect(() => {
    commandsRef.current = commands;
  }, [commands]);

  const selection = useCommandSelection({
    selectedId,
    setSelectedId,
    setSelectedRuleIndex,
  });
  const selectedIdRef = selection.selectedIdRef;
  const pendingAutoSelectIdRef = selection.pendingAutoSelectIdRef;
  const pendingAutoSelectRuleIndexRef = selection.pendingAutoSelectRuleIndexRef;

  const ruleUidsRef = useRef<Record<string, string[]>>({});

  /**
   * 确保某个命令拥有与 rules 数量一致的 ruleUid 列表。
   *
   * @param cmdId 命令 id。
   * @param ruleCount 规则数量。
   * @returns 无返回值。
   */
  function ensureRuleUids(cmdId: string, ruleCount: number): void {
    if (!cmdId) return;
    const prev = ruleUidsRef.current[cmdId] ?? [];
    if (prev.length === ruleCount) return;
    const next = [...prev];
    while (next.length < ruleCount) next.push(createRuleUid());
    if (next.length > ruleCount) next.length = ruleCount;
    ruleUidsRef.current[cmdId] = next;
  }

  useEffect(() => {
    for (const c of commands) ensureRuleUids(c.id, c.rules?.length ?? 0);
  }, [commands]);

  useMessageRouter({
    vscodeApi,
    getUntitledTitle,
    setCommands,
    setSelectedId,
    setSelectedRuleIndex,
    setDirty,
    commands,
    commandsRef,
    selectedIdRef,
    savedSnapshotRef,
    pendingAutoSelectIdRef,
    pendingAutoSelectRuleIndexRef,
    pendingAutoSavePayloadRef,
    autoCreatedRef,
    initialUntitledEnsuredRef,
    draftIdRef,
    createDraftCommand,
    uiLocaleRef,
  });

  /**
   * 判断某个命令是否相对“已保存快照”发生变化（用于左侧菜单展示 `*`）。
   *
   * @param cmd 命令对象。
   * @returns 是否有未保存变更。
   */
  function isCommandDirty(cmd: ReplaceCommand): boolean {
    const snap = savedSnapshotRef.current;
    const snapCmd = snap?.find((c) => c.id === cmd.id);
    if (!snapCmd) return true;
    return JSON.stringify(snapCmd) !== JSON.stringify(cmd);
  }

  /**
   * 判断某条规则是否相对“已保存快照”发生变化（用于左侧二级菜单展示 `*`）。
   *
   * @param cmd 当前命令。
   * @param ruleIndex 规则索引。
   * @returns 是否有未保存变更。
   */
  function isRuleDirty(cmd: ReplaceCommand, ruleIndex: number): boolean {
    const snap = savedSnapshotRef.current;
    const snapCmd = snap?.find((c) => c.id === cmd.id);
    const curRule = cmd.rules?.[ruleIndex];
    if (!curRule) return false;
    const snapRule = snapCmd?.rules?.[ruleIndex];
    if (!snapRule) return true;
    return JSON.stringify(snapRule) !== JSON.stringify(curRule);
  }

  /**
   * 归一化命令标题：把“未命名命令/Untitled command”统一显示为当前语言的标题。
   *
   * @param list 命令列表。
   * @returns 归一化后的命令列表（不会改变其它字段）。
   */
  function normalizeCommandTitlesForLanguage(list: ReplaceCommand[]): ReplaceCommand[] {
    return normalizeCommandTitles(list, t.untitledCommand);
  }

  useEffect(() => {
    setCommands((prev) => normalizeCommandTitlesForLanguage(prev));
  }, [lang]);

  const prevUiLangForSeedRef = useRef<LanguageCode | null>(null);

  /**
   * 界面语言切换后：重新拉取开发种子 JSON，并把 `dev_sample_*` 演示命令的标题/描述/规则标题
   * 合并进当前列表（不改动规则表达式）；有未保存改动时跳过，避免覆盖用户编辑。
   */
  useEffect(() => {
    if (prevUiLangForSeedRef.current === null) {
      prevUiLangForSeedRef.current = lang;
      return;
    }
    if (prevUiLangForSeedRef.current === lang) return;
    prevUiLangForSeedRef.current = lang;
    let cancelled = false;
    void (async () => {
      const seed = await fetchAndSanitizeDevSeedCommands(lang);
      if (cancelled || !isMountedRef.current || !seed.length) return;
      setCommands((prev) => {
        if (dirtyRef.current) return prev;
        const merged = mergeDevSeedDisplayFields(prev, seed);
        savedSnapshotRef.current = structuredClone(merged) as ReplaceCommand[];
        return merged;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      const msg = String(e.message || '');
      if (msg.includes('ResizeObserver loop completed with undelivered notifications')) {
        e.preventDefault();
        return;
      }
    };
    window.addEventListener('error', onError);
    return () => window.removeEventListener('error', onError);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.title.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [commands, search]);

  const regexFlagLabels = useMemo(
    () => ({
      flags: t.flags,
      flagG: t.flagG,
      flagI: t.flagI,
      flagM: t.flagM,
      flagS: t.flagS,
      flagU: t.flagU,
      flagY: t.flagY,
    }),
    [t],
  );

  const selected = useMemo(
    () => commands.find((c) => c.id === selectedId) ?? (commands[0] ?? undefined),
    [commands, selectedId],
  );

  const selectedRule = useMemo(() => selected?.rules?.[selectedRuleIndex], [selected, selectedRuleIndex]);
  const hasAnyUntitledCommand = useMemo(() => commands.some((c) => isUntitledCommandTitle(c.title)), [commands]);

  const savedCommandsForHooks = useMemo(() => commands.filter((c) => !isPristineUntitledDraft(c)), [commands]);


  /**
   * 获取 hook 下拉选项（排除自身、排除草稿），并提供环检测禁用。
   *
   * @returns 选项数组。
   */
  const hookOptions = useMemo(() => getHookOptions(savedCommandsForHooks, selected?.id ?? ''), [savedCommandsForHooks, selected?.id]);

  /**
   * 添加前置/后置 hook 命令。
   *
   * @param phase 阶段：pre/post。
   * @param hookId hook 命令 id。
   * @returns 无返回值。
   */
  function addHookCommand(phase: HookPhase, hookId: string): void {
    if (!selected) return;
    if (!hookId) return;
    if (wouldCreateLoop(savedCommandsForHooks, selected.id, hookId)) return;
    const current = getSelectedRuleHooks(selected, selectedRuleIndex, phase);
    if (current.includes(hookId)) return;
    if (current.length >= 3) {
      vscodeApi.postMessage({ type: 'showInfo', payload: { message: tRef.current.hookMax3 } });
      return;
    }
    updateSelectedCommand((cmd) => {
      const rules = [...cmd.rules];
      const r = rules[selectedRuleIndex] ?? rules[0];
      const prev = phase === 'pre' ? [...(r.preCommands ?? [])] : [...(r.postCommands ?? [])];
      if (!prev.includes(hookId)) prev.push(hookId);
      const nextRule = phase === 'pre' ? { ...r, preCommands: prev } : { ...r, postCommands: prev };
      rules[selectedRuleIndex] = nextRule;
      // 写入规则级 hook 后，清理命令级旧配置，避免语义混淆
      return { ...cmd, rules };
    });
  }

  /**
   * 移除前置/后置 hook 命令。
   *
   * @param phase 阶段：pre/post。
   * @param hookId hook 命令 id。
   * @returns 无返回值。
   */
  function removeHookCommand(phase: HookPhase, hookId: string): void {
    if (!selected) return;
    updateSelectedCommand((cmd) => {
      const rules = [...cmd.rules];
      const r = rules[selectedRuleIndex] ?? rules[0];
      const prev = phase === 'pre' ? [...(r.preCommands ?? [])] : [...(r.postCommands ?? [])];
      const next = prev.filter((x) => x !== hookId);
      const nextRule = phase === 'pre' ? { ...r, preCommands: next } : { ...r, postCommands: next };
      rules[selectedRuleIndex] = nextRule;
      return { ...cmd, rules };
    });
  }

  /**
   * 调整当前规则的 hook 命令顺序（用于拖拽排序）。
   *
   * @param phase 阶段：pre/post。
   * @param nextIds 重新排序后的 id 列表。
   * @returns 无返回值。
   */
  function reorderHookCommands(phase: HookPhase, nextIds: string[]): void {
    if (!selected) return;
    updateSelectedCommand((cmd) => {
      const rules = [...cmd.rules];
      const r = rules[selectedRuleIndex] ?? rules[0];
      const prev = phase === 'pre' ? [...(r.preCommands ?? [])] : [...(r.postCommands ?? [])];
      // 仅在元素集合一致时写回，避免异常 drop 造成丢失
      const prevSet = new Set(prev);
      const next = nextIds.filter((x) => prevSet.has(x));
      if (next.length !== prev.length) return cmd;
      const nextRule = phase === 'pre' ? { ...r, preCommands: next } : { ...r, postCommands: next };
      rules[selectedRuleIndex] = nextRule;
      return { ...cmd, rules };
    });
  }

  /**
   * 复制底部当前激活页签的输出内容到剪贴板（仅替换/列表）。
   *
   * @param tab 当前页签。
   * @returns 无返回值。
   */
  async function copyActiveToolsResult(tab: ToolsTab): Promise<void> {
    const text =
      tab === 'replace'
        ? (replacePreview?.finalText ??
            ((replacePreview?.parts ?? []).map((p) => p.text).join('') || (replacePreview?.text ?? '')))
        : tab === 'list'
          ? (testerMatches.matches.length >= 20_000 ? testerMatches.matches.slice(0, 20_000) : testerMatches.matches)
              .map((m) => m.matchText)
              .join('\n')
          : '';
    const ok = await copyTextToClipboard(text);
    Toast.show(ok ? tRef.current.copied : tRef.current.copyFailed, ok ? 'info' : 'error');
  }

  const regexPreview = useMemo(() => {
    if (!selectedRule || selectedRule.engine !== 'regex') return undefined;
    const pattern = selectedRule.find ?? '';
    const flags = selectedRule.flags ?? 'g';
    return { pattern, flags, tokens: tokenizeRegexPattern(pattern) };
  }, [selectedRule]);

  /**
   * 切换当前规则的 flags（多选），并强制包含 g。
   *
   * @param flag 要切换的 flag 字符。
   * @returns 无返回值。
   */
  function toggleCurrentRuleFlag(flag: string): void {
    if (!selected) return;
    if (selected.rules[selectedRuleIndex]?.engine !== 'regex') return;
    updateSelectedCommand((cmd) => {
      const rules = [...cmd.rules];
      const prev = rules[selectedRuleIndex];
      const prevFlags = prev.flags ?? 'g';
      const enabled = prevFlags.includes(flag);
      const nextFlags = enabled ? prevFlags.replaceAll(flag, '') : `${prevFlags}${flag}`;
      rules[selectedRuleIndex] = { ...prev, flags: nextFlags || 'g' };
      return { ...cmd, rules };
    });
    testerMatches.scheduleCompute();
  }

  /**
   * 设置当前规则的启用状态，并写回配置。
   *
   * - 缺省视为启用，因此启用时会删除 enable 字段（避免落盘冗余）。
   * - 禁用时写入 enable=false。
   *
   * @param enabled 是否启用。
   * @returns 无返回值。
   */
  function setCurrentRuleEnabled(enabled: boolean): void {
    if (!selected) return;
    const cmdId = selected.id;
    let nextList: ReplaceCommand[] | null = null;
    setCommands((prev) => {
      const next = prev.map((c) => {
        if (c.id !== cmdId) return c;
        const rules = [...c.rules];
        const cur = rules[selectedRuleIndex];
        if (!cur) return c;
        const nextRule = { ...cur } as any;
        if (enabled) delete nextRule.enable;
        else nextRule.enable = false;
        rules[selectedRuleIndex] = nextRule;
        return { ...c, rules };
      });
      nextList = next;
      return next;
    });
    setDirty(true);
    if (nextList) {
      commandsRef.current = nextList;
      // 自动保存：只保存 enable 状态，不因历史命名问题阻塞开关操作。
      window.setTimeout(() => {
        if (!isMountedRef.current) return;
        requestSaveFrom(nextList as ReplaceCommand[], { validateNames: false });
      }, 0);
    }
  }

  useEffect(() => {
    setSelectedRuleIndex(0);
  }, [selected?.id]);

  const uiCache = useRuleUiCache({
    isReady: isTestEditorReady,
    selectedCmdId: selected?.id,
    selectedRuleIndex,
    selectedRuleUid: selected?.id ? ruleUidsRef.current[selected.id]?.[selectedRuleIndex] : undefined,
    getDefaultReplaceTemplate,
    getDefaultTestText: (cmdId: string, ruleIndex: number): string => {
      const cmd = commandsRef.current.find((c) => c.id === cmdId);
      const rule = (cmd?.rules?.[ruleIndex] ?? undefined) as any;
      const raw = rule?.testText;
      return typeof raw === 'string' ? raw : '';
    },
    onRestore: () => onRestoreRef.current?.(),
  });

  const testerRule = (selected?.rules?.[selectedRuleIndex] ?? undefined) as unknown as TesterReplaceRule | undefined;
  const testerMatches = useTesterMatchesCm({
    isReady: isTestEditorReady,
    viewRef: testEditorRef,
    selectedRule: testerRule,
    depsKey: `${selectedId ?? ''}::${selectedRuleIndex}::${testerRule?.engine ?? ''}::${testerRule?.find ?? ''}::${testerRule?.flags ?? ''}::${testerRule?.wildcardOptions?.dotAll ?? ''}`,
    text: uiCache.testText,
    currentMatchIndex: uiCache.currentMatchIndex,
    setCurrentMatchIndex: uiCache.setCurrentMatchIndex,
  });

  useEffect(() => {
    onRestoreRef.current = () => testerMatches.clearMatches();
  }, [testerMatches]);

  const toolsTab = uiCache.toolsTab;
  const setToolsTab = uiCache.setToolsTab;
  const replaceInput = uiCache.replaceInput;
  const setReplaceInput = uiCache.setReplaceInput;
  const replaceMode = (selectedRule?.replaceMode ?? 'template') as 'template' | 'map';
  const selectedRuleEngine = selectedRule?.engine;
  const canReplaceMap = selectedRuleEngine === 'regex';
  /** 主规则「查找」正则的捕获组个数，供替换模板 `$n` 高亮分词（避免 `$1` 后数字被并入 `$13`）。 */
  const replacementTemplateMaxCaptureGroups = useMemo(() => {
    if (selectedRule?.engine !== 'regex') return 0;
    const flags = selectedRule.flags ?? 'g';
    return countCapturingGroups(String(selectedRule.find ?? ''), flags);
  }, [selectedRule?.engine, selectedRule?.find, selectedRule?.flags]);
  const effectiveReplaceMode = canReplaceMap ? replaceMode : 'template';
  const currentMatchIndex = uiCache.currentMatchIndex;
  const testText = uiCache.testText;
  const setTestText = uiCache.setTestText;
  const saveTestTextChecked = (selectedRule as any)?.testText !== undefined;
  const applyPreHooks = uiCache.applyPreHooks;
  const setApplyPreHooks = uiCache.setApplyPreHooks;
  const applyPostHooks = uiCache.applyPostHooks;
  const setApplyPostHooks = uiCache.setApplyPostHooks;
  const applyPrevRules = uiCache.applyPrevRules;
  const setApplyPrevRules = uiCache.setApplyPrevRules;

  const matches = testerMatches.matches;

  const toolsPreviewFillClassName = 'toolsPreview toolsPreviewFill';

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    // 规则切换后，允许更快触发一次重算（避免依赖 debounce 带来的延迟感）
    if (!isTestEditorReady) return;
    testerMatches.scheduleCompute();
  }, [isTestEditorReady, selectedId, selectedRuleIndex]);

  useEffect(() => {
    const rule = testerRule;
    if (!rule) {
      setReplacePreview({ count: 0, text: '', parts: [], finalText: '' });
      return;
    }
    try {
      const cmd = selected;
      const allForHooks = savedCommandsForHooks;

      const preIds = cmd ? getSelectedRuleHooks(cmd, selectedRuleIndex, 'pre') : [];
      const postIds = cmd ? getSelectedRuleHooks(cmd, selectedRuleIndex, 'post') : [];

      const hookOpts = { ignoreUnknownHookId: true, maxDepth: 12 };

      /**
       * 安全执行 hook 链：发生环路时提示并回退为原文本（避免 Replace 预览空白）。
       *
       * @param input 输入文本。
       * @param ids hook id 列表。
       * @returns 执行后的文本；异常时返回 input。
       */
      function safeRunHookChain(input: string, ids: string[]): string {
        if (!ids.length) return input;
        try {
          return runHookChainOnText(input, ids, allForHooks, hookOpts);
        } catch (e) {
          if (e instanceof HookLoopError) {
            Toast.show(e.message, 'error');
            return input;
          }
          return input;
        }
      }

      const base = applyPreHooks && preIds.length ? safeRunHookChain(testText, preIds) : testText;

      let beforeCurrent = base;
      if (applyPrevRules && cmd && selectedRuleIndex > 0) {
        for (let i = 0; i < selectedRuleIndex; i += 1) {
          const r = cmd.rules[i];
          if (!r) continue;
          beforeCurrent = applyRule(beforeCurrent, r).text;
        }
      }

      const res = computeReplacePreview(rule, beforeCurrent, uiCache.replaceInput, {
        maxPreviewChars: 200_000,
        collectHighlightParts: replacePreviewHighlight,
      });
      const afterCurrent = res.fullText;
      const finalText = applyPostHooks && postIds.length ? safeRunHookChain(afterCurrent, postIds) : afterCurrent;

      const parts = applyPostHooks ? [] : res.previewParts;
      const text = applyPostHooks ? finalText : res.previewText;
      setReplacePreview({ count: res.replacedCount, text, parts, finalText });
    } catch {
      setReplacePreview({ count: 0, text: '', parts: [], finalText: '' });
    }
  }, [
    selectedId,
    selectedRuleIndex,
    testerRule?.find,
    testerRule?.engine,
    (selectedRule as any)?.replaceMode,
    JSON.stringify(((selectedRule as any)?.map ?? {}) as any),
    testerRule?.flags,
    testerRule?.wildcardOptions?.dotAll,
    uiCache.replaceInput,
    uiCache.testTextVersion,
    testText,
    applyPreHooks,
    applyPostHooks,
    applyPrevRules,
    replacePreviewHighlight,
  ]);

  /**
   * 更新当前选中命令，并标记 dirty。
   *
   * @param updater 更新函数。
   * @returns 无返回值。
   */
  function updateSelectedCommand(updater: (cmd: ReplaceCommand) => ReplaceCommand): void {
    if (!selected) return;
    setCommands((prev) => prev.map((c) => (c.id === selected.id ? updater(c) : c)));
    setDirty(true);
  }

  /**
   * 获取某个（命令 + 规则）的默认替换模板（用于缓存缺失时回退）。
   *
   * @param cmdId 命令 id。
   * @param ruleIndex 规则索引。
   * @returns 默认替换模板文本。
   */
  function getDefaultReplaceTemplate(cmdId: string, ruleIndex: number): string {
    const cmd = commandsRef.current.find((c) => c.id === cmdId);
    const rule = cmd?.rules?.[ruleIndex];
    return (rule?.replace ?? '').toString();
  }
  /**
   * 判断某个命令是否允许显示删除按钮（未命名命令隐藏）。
   *
   * @param cmd 命令对象。
   * @returns 是否可显示删除按钮。
   */
  function isCommandDeletable(cmd: ReplaceCommand): boolean {
    // 未命名命令（草稿/默认）不允许删除
    if (isUntitledCommandTitle(cmd.title)) return false;
    return true;
  }

  /**
   * 仅用于“删除后自动落盘”：无需弹窗命名、也不做“必须有可保存规则”的拦截校验。
   *
   * @param nextList 删除后的命令列表。
   * @returns 无返回值。
   */
  function scheduleAutoSaveAfterDelete(nextList: ReplaceCommand[]): void {
    pendingAutoSavePayloadRef.current = buildPayloadFromList(nextList, isPristineUntitledDraft);
  }

  const saveFlow = useSaveFlow({
    lang,
    t: {
      nameRequired: t.nameRequired,
      nameDuplicate: t.nameDuplicate,
      nameReservedChars: (t as any).nameReservedChars ?? '名称中不允许包含保留字符：<>[]',
      ruleTitleReservedChars: (t as any).ruleTitleReservedChars ?? '规则标题中不允许包含保留字符：<>[]',
      ruleLabel: t.ruleLabel,
      addRuleFirst: t.addRuleFirst,
      confirm: t.confirm,
      cancel: t.cancel,
      mapOnlyRegex: (t as any).mapOnlyRegex,
      mapEmpty: (t as any).mapEmpty,
      mapMatchRequired: (t as any).mapMatchRequired,
      mapItemRegexInvalid: (t as any).mapItemRegexInvalid,
    },
    toast: Toast,
    commands,
    setCommands: (next) => setCommands(next),
    setDirty,
    selectedId,
    selectedIdRef,
    selectedRuleIndex,
    setSelectedRuleIndex,
    commandsRef,
    savedSnapshotRef,
    vscodeApi,
    openRenameCommand,
  });
  const requestSaveFrom = saveFlow.requestSaveFrom;
  const requestSave = saveFlow.requestSave;

  useEffect(() => {
    /**
     * 监听页面级保存快捷键（Ctrl/Cmd + S），并触发当前激活命令的保存流程。
     *
     * @param e 键盘事件对象。
     * @returns 无返回值。
     */
    const onKeyDown = (e: KeyboardEvent): void => {
      const isSaveHotkey = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's';
      if (!isSaveHotkey) return;
      e.preventDefault();
      e.stopPropagation();
      if (!dirtyRef.current) return;
      requestSaveFrom(commandsRef.current);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const snapshotReset = useSnapshotReset({
    savedSnapshotRef,
    commandsRef,
    selectedIdRef,
    selectedRuleIndex,
    setCommands: (next) => setCommands(next),
    setSelectedId,
    setSelectedRuleIndex,
    setDirty,
    ensureRuleUids,
    createDraftCommand,
    createDefaultRule,
    getUntitledTitle: () => tRef.current.untitledCommand,
    testerMatches,
  });
  const requestResetToSaved = snapshotReset.requestResetToSaved;

  const modals = useAppModals({
    lang,
    t: {
      ruleLabel: t.ruleLabel,
      cancel: t.cancel,
      confirm: t.confirm,
      untitledCommand: t.untitledCommand,
      hookDepPhasePre: t.hookDepPhasePre,
      hookDepPhasePost: t.hookDepPhasePost,
      hookDepModalDeleteTitle: t.hookDepModalDeleteTitle,
      hookDepIntroDelete: t.hookDepIntroDelete,
      hookDepModalDisableTitle: t.hookDepModalDisableTitle,
      hookDepIntroDisableSimple: t.hookDepIntroDisableSimple,
      hookDepIntroDisableDepsHint: t.hookDepIntroDisableDepsHint,
      hookDepRemoveFromOthers: t.hookDepRemoveFromOthers,
      hookDepRowCheckboxAria: t.hookDepRowCheckboxAria,
    },
    modalApi: {
      openRenameCommand,
      requestConfirm,
      async showHookDepModal(data) {
        return await showRefModal(HookDependencyConfirmModal, data as any);
      },
    },
    toast: Toast,
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
  });

  const leftPanelProps = useLeftPanelActions({
    commands,
    setCommands,
    setSelectedId,
    setSelectedRuleIndex,
    setDirty,
    setSearch,
    search,
    vscodeApi,
    t,
    filtered,
    hasAnyUntitledCommand,
    selectedId,
    selectedIdRef,
    selectedRuleIndex,
    pendingAutoSelectIdRef,
    createDraftCommand,
    createDefaultRule,
    scheduleAutoSaveAfterDelete,
    onOpenRename: (cmdId, initialTitle, continueSave) => void openRenameCommand(cmdId, initialTitle, continueSave),
    isCommandDeletable,
    isCommandDirty,
    isRuleDirty,
  });

  /**
   * 按给定 id 顺序重排命令，并自动保存“顺序变更”（不落盘其它未保存改动）。
   *
   * @param nextCmdIds 新的命令 id 顺序。
   * @returns 无返回值。
   */
  function reorderCommandsAndSave(nextCmdIds: string[]): void {
    // UI 顺序先更新（不落盘其它改动）
    setCommands((prev) => {
      return computeReorderedCommands(prev, nextCmdIds);
    });

    // 仅保存“顺序”：基于已保存快照重排并落盘，避免把当前激活命令的未保存内容一起保存。
    const snap = savedSnapshotRef.current;
    if (!snap || snap.length === 0) return;
    const payload = computeReorderPayloadFromSnapshot(snap, nextCmdIds);
    if (!payload) return;
    vscodeApi.postMessage({ type: 'setConfig', payload });
    savedSnapshotRef.current = structuredClone(payload) as ReplaceCommand[];
  }

  return (
    <Layout.Client
      ref={appHostRef}
      style={{
        gridTemplateColumns: leftCollapsed ? `0px 6px minmax(0, 1fr)` : `${layout.leftWidth}px 6px minmax(0, 1fr)`,
      }}
    >
      <Layout.Sider>
        {leftCollapsed ? null : (
          <LeftPanel
            leftWidth={layout.leftWidth}
            {...leftPanelProps}
            onReorderCommands={reorderCommandsAndSave}
            onDeleteCommand={(cmdId) => void modals.confirmDeleteCommandWithDeps(cmdId)}
            onConfirm={requestConfirm}
            getRuleUids={(cmdId) => {
              const cmd = commandsRef.current.find((c) => c.id === cmdId);
              ensureRuleUids(cmdId, cmd?.rules?.length ?? 0);
              return ruleUidsRef.current[cmdId] ?? [];
            }}
            onReorderRules={(cmdId, nextRuleUids) => {
              const cmd = commandsRef.current.find((c) => c.id === cmdId);
              if (!cmd) return;
              ensureRuleUids(cmdId, cmd.rules.length);
              const prevUids = ruleUidsRef.current[cmdId] ?? [];
              const prevSelectedUid = prevUids[selectedRuleIndex];
              const uidToRule = new Map<string, ReplaceRule>();
              for (let i = 0; i < cmd.rules.length; i += 1) {
                const uid = prevUids[i];
                const rule = cmd.rules[i];
                if (uid && rule) uidToRule.set(uid, rule);
              }

              const nextRules: ReplaceRule[] = [];
              for (const uid of nextRuleUids) {
                const r = uidToRule.get(uid);
                if (r) nextRules.push(r);
              }
              if (nextRules.length !== cmd.rules.length) return;

              ruleUidsRef.current[cmdId] = [...nextRuleUids];
              const nextSelectedIndex = prevSelectedUid ? nextRuleUids.indexOf(prevSelectedUid) : -1;
              if (nextSelectedIndex >= 0) setSelectedRuleIndex(nextSelectedIndex);

              updateSelectedCommand((c) => (c.id === cmdId ? { ...c, rules: nextRules } : c));
            }}
          />
        )}
      </Layout.Sider>

      <Splitter
        orientation="vertical"
        onMouseDown={(e) => {
          if (leftCollapsed) return;
          const minRight = 360;
          const hostW = appHostRef.current?.clientWidth ?? window.innerWidth;
          const maxByViewport = Math.max(180, hostW - 6 - minRight);
          const max = Math.min(520, maxByViewport);
          attachVerticalSplitDrag(e, {
            startWidth: layout.leftWidth,
            min: 180,
            max,
            onResize: (nextWidth) => setLayout((prev) => ({ ...prev, leftWidth: nextWidth })),
          });
        }}
        toggleButton={
          showSplitterToggleArrow
            ? {
                visible: true,
                title: leftCollapsed ? t.expandSidebar : t.collapseSidebar,
                label: leftCollapsed ? '»' : '«',
                onClick: () => setLeftCollapsedAndPersist(!leftCollapsed),
              }
            : undefined
        }
      />

      <Layout.Content className="rightPanel" style={{ gridTemplateRows: `auto 1fr 6px ${layout.toolsHeight}px` }}>
        <Layout.Header className="toolbar">
          <Layout.Row justify="space-between" align="center" gap={8}>
            <Layout.Row className="toolbarLeft" justify="start" align="center" gap={8}>
              <Tooltip content={(t as any).newRuleTip ?? t.newRule}>
                <Button
                  preset="topIcon"
                  type="primary"
                  disabled={!selected}
                  aria-label={t.newRule}
                  onClick={() => {
                    if (!selected) return;
                    const cmdId = selected.id;
                    const editor = testEditorRef.current;
                    ensureRuleUids(cmdId, selected.rules.length);
                    const currentRuleUid = ruleUidsRef.current[cmdId]?.[selectedRuleIndex] ?? createRuleUid();
                    const currentRuleKey = buildRuleKey(cmdId, currentRuleUid);
                    if (editor && currentRuleKey) {
                      // 当前规则的 UI 临时态会在 useRuleUiCache 内自动写回；这里只需为新规则预置一份空缓存。
                    }
                    setCommands((prev) => {
                      let nextIndex = 0;
                      const next = prev.map((cmd) => {
                        if (cmd.id !== cmdId) return cmd;
                        nextIndex = cmd.rules.length;
                        ensureRuleUids(cmdId, cmd.rules.length + 1);
                        return { ...cmd, rules: [...cmd.rules, createDefaultRule()] };
                      });
                      const nextRuleUid = ruleUidsRef.current[cmdId]?.[nextIndex] ?? createRuleUid();
                      uiCache.primeRuleCache(cmdId, nextIndex, nextRuleUid, {
                        testText: '',
                        replaceTemplate: '',
                        toolsTab: 'replace',
                        currentMatchIndex: undefined,
                        listScrollTop: 0,
                      });
                      pendingAutoSelectRuleIndexRef.current = nextIndex;
                      return next;
                    });
                    setDirty(true);
                  }}
                >
                  <Icon type="add" />
                </Button>
              </Tooltip>
              <Tooltip content={`${t.save}${dirty ? ' *' : ''}`}>
                <Button
                  preset="topIcon"
                  disabled={!dirty}
                  aria-label={t.save}
                  onClick={() => {
                    requestSave();
                  }}
                >
                  💾
                  {dirty ? <span className="iconDirtyStar">*</span> : null}
                </Button>
              </Tooltip>
              <Tooltip content={t.reset}>
                <Button
                  preset="topIcon"
                  disabled={!dirty}
                  aria-label={t.reset}
                  onClick={() => {
                    requestResetToSaved();
                  }}
                >
                  ↺
                </Button>
              </Tooltip>

              {selected?.rules?.[selectedRuleIndex] ? (
                <Layout.Row align="center" gap={6}>
                  {(() => {
                    const rule = selected.rules[selectedRuleIndex];
                    const isEnabled = rule.enable !== false;
                    const hideEnable = isUntitledCommandTitle(selected.title);
                    if (hideEnable) return null;
                    return (
                      <Layout.Row className="rrRuleEnableToggle" align="center" gap={4}>
                        <Tooltip content={(t as any).ruleEnableTip ?? (t as any).ruleEnabled}>
                          <Button
                            preset="chip"
                            className="rrRuleEnableChip"
                            active={isEnabled}
                            aria-label={isEnabled ? (t as any).ruleEnabled : (t as any).ruleDisabled}
                            onClick={() => void modals.requestRuleEnableButtonClick(setCurrentRuleEnabled)}
                          >
                            {isEnabled ? (t as any).ruleEnabled : (t as any).ruleDisabled}
                          </Button>
                        </Tooltip>
                      </Layout.Row>
                    );
                  })()}
                  {selectedRuleIndex > 0 ? (
                    <Checkbox
                      checked={applyPrevRules}
                      onChange={(v) => setApplyPrevRules(v)}
                      tooltip={t.applyPrevRules}
                      ariaLabel={t.applyPrevRules}
                    />
                  ) : null}
                  <RuleTitleEditor
                    value={selected.rules[selectedRuleIndex].title}
                    fallbackLabel={`${t.ruleLabel} ${selectedRuleIndex + 1}`}
                    placeholder={t.ruleTitlePlaceholder}
                    defaultTitleTip={(t as any).ruleTitleDefaultTip ?? ''}
                    onCommit={(nextTitle) => {
                      const prevTitle = selected.rules[selectedRuleIndex].title;
                      const prevNorm = (prevTitle ?? '').trim();
                      const nextNorm = (nextTitle ?? '').trim();
                      if (prevNorm === nextNorm) return; // 未变化：不标记 dirty
                      const err = validateRuleTitle(
                        String(nextTitle ?? ''),
                        (t as any).ruleTitleReservedChars ?? '规则标题中不允许包含保留字符：<>[]',
                      );
                      if (err) {
                        Toast.show(err, 'error');
                        return;
                      }
                      updateSelectedCommand((cmd) => {
                        const rules = [...cmd.rules];
                        const cur = rules[selectedRuleIndex];
                        if (!cur) return cmd;
                        rules[selectedRuleIndex] = { ...cur, title: nextTitle };
                        return { ...cmd, rules };
                      });
                    }}
                  />
                </Layout.Row>
              ) : null}
            </Layout.Row>
            <Layout.Row className="toolbarRight" justify="end" align="center" gap={8}>
              <DropdownMenu
                buttonLabel={lang === 'zh-CN' 
                  ? t.languageOptionZhCN 
                  : t.languageOptionEn}
                buttonTitle={t.languageUi}
                mode="single"
                name="rr-ui-language"
                closeOnToggle
                placement="bottom-end"
                indicator="radio"
                options={(
                  [
                    { id: 'en' as const, label: t.languageOptionEn },
                    { id: 'zh-CN' as const, label: t.languageOptionZhCN },
                  ] as const
                ).map((opt) => ({
                  id: opt.id,
                  label: opt.label,
                  checked: lang === opt.id,
                }))}
                onToggle={(id) => {
                  const next = id as LanguageCode;
                  setLang(next);
                }}
              />
              {selected?.rules?.[selectedRuleIndex] ? (
                <DropdownMenu
                  buttonLabel={selected.rules[selectedRuleIndex].engine}
                  buttonTitle={t.engine}
                  mode="single"
                  name="rr-engine"
                  closeOnToggle
                  placement="bottom-end"
                  indicator="radio"
                  options={(['regex', 'text', 'wildcard'] as const).map((eng) => ({
                    id: eng,
                    label: eng,
                    checked: selected.rules[selectedRuleIndex].engine === eng,
                  }))}
                  onToggle={(id) => {
                    const eng = id as 'regex' | 'text' | 'wildcard';
                    updateSelectedCommand((cmd) => {
                      const rules = [...cmd.rules];
                      const cur = rules[selectedRuleIndex] as any;
                      const nextRule = { ...cur, engine: eng } as any;
                      // wildcard/text 下不支持 map($1)替换语义：同步回 template，保证预览与 UI 一致。
                      if (eng !== 'regex') nextRule.replaceMode = 'template';
                      rules[selectedRuleIndex] = nextRule;
                      return { ...cmd, rules };
                    });
                    testerMatches.scheduleCompute();
                  }}
                />
              ) : null}
            </Layout.Row>
          </Layout.Row>
        </Layout.Header>

        <Layout.Content className="content">
          <Layout.Content className="panel">
            {selected?.rules?.[selectedRuleIndex] ? (
              <div className="expressionBar">
                {(() => {
                  const preIds = getSelectedRuleHooks(selected, selectedRuleIndex, 'pre');
                  const preItems = preIds.map((id) => ({
                    id,
                    label: savedCommandsForHooks.find((c) => c.id === id)?.title ?? id,
                    title: id,
                  }));
                  if (!preItems.length) return null;
                  return (
                    <Layout.Row align="center" gap={10} style={{ padding: '0 2px', flexWrap: 'wrap' }}>
                      <Layout.Row align="center" gap={6} style={{ opacity: 0.85, flex: 'none' }}>
                        <span>{(t as any).preCommandFull ?? '前置命令'}</span>
                        <Checkbox
                          checked={applyPreHooks}
                          onChange={(v) => setApplyPreHooks(v)}
                          tooltip={(t as any).applyPreHooksTip ?? t.applyPreHooks}
                          ariaLabel={t.applyPreHooks}
                        />
                      </Layout.Row>
                      <HookChipsBar
                        className="hookChipsTop"
                        title={undefined}
                        items={preItems}
                        onRemove={(id) => removeHookCommand('pre', id)}
                        onReorder={(nextIds) => reorderHookCommands('pre', nextIds)}
                      />
                    </Layout.Row>
                  );
                })()}

                <Layout.Row className="expressionRow" align="center" gap={8}>
                  {(() => {
                    const ids = getSelectedRuleHooks(selected, selectedRuleIndex, 'pre');
                    const limitReached = ids.length >= 3;
                    return (
                      <DropdownMenu
                        buttonLabel={t.preCommand}
                        buttonLabelSuffix={
                          <Tooltip content={(t as any).preCommandTip ?? (t as any).preCommandFull ?? '前置命令'}>
                            <span
                              className="rrHookTitleHelpIcon"
                              aria-label={(t as any).preCommandTip ?? (t as any).preCommandFull ?? '前置命令'}
                              role="img"
                            >
                              ?
                            </span>
                          </Tooltip>
                        }
                        buttonActive={ids.length > 0}
                        mode="single"
                        placement="bottom-start"
                        indicator="none"
                        closeOnToggle
                        minMenuWidth={320}
                        options={hookOptions.map((o) => {
                          const alreadySelected = ids.includes(o.id);
                          const disabled = o.disabled || alreadySelected || (limitReached && !alreadySelected);
                          const title = o.disabled ? t.loopBlocked : alreadySelected ? t.hookAlreadySelected : limitReached ? t.hookMax3 : o.title;
                          return { id: o.id, label: o.title, disabled, title };
                        })}
                        onToggle={(id) => {
                          addHookCommand('pre', id);
                        }}
                      />
                    );
                  })()}
                  <RuleExpressionField
                    engine={selected.rules[selectedRuleIndex].engine}
                    value={selected.rules[selectedRuleIndex].find}
                    placeholder={t.expressionPlaceholder}
                    onChange={(v) => {
                      updateSelectedCommand((cmd) => {
                        const rules = [...cmd.rules];
                        rules[selectedRuleIndex] = { ...rules[selectedRuleIndex], find: v };
                        return { ...cmd, rules };
                      });
                    }}
                    regexEnabledFlags={regexPreview?.flags}
                    onToggleFlag={(f) => toggleCurrentRuleFlag(f)}
                    flagLabels={regexFlagLabels}
                    uiLanguage={lang}
                    onAfterChange={() => {
                      // 表达式变更会通过 useTesterMatchesCm 的 depsKey 立即重算，这里不再手动触发，避免闭包读取旧规则导致“慢一拍”。
                    }}
                  />

                  {(() => {
                    const ids = getSelectedRuleHooks(selected, selectedRuleIndex, 'post');
                    const limitReached = ids.length >= 3;
                    return (
                      <DropdownMenu
                        buttonLabel={t.postCommand}
                        buttonLabelSuffix={
                          <Tooltip content={(t as any).postCommandTip ?? (t as any).postCommandFull ?? '后置命令'}>
                            <span
                              className="rrHookTitleHelpIcon"
                              aria-label={(t as any).postCommandTip ?? (t as any).postCommandFull ?? '后置命令'}
                              role="img"
                            >
                              ?
                            </span>
                          </Tooltip>
                        }
                        buttonActive={ids.length > 0}
                        mode="single"
                        placement="bottom-end"
                        indicator="none"
                        closeOnToggle
                        minMenuWidth={320}
                        options={hookOptions.map((o) => {
                          const alreadySelected = ids.includes(o.id);
                          const disabled = o.disabled || alreadySelected || (limitReached && !alreadySelected);
                          const title = o.disabled ? t.loopBlocked : alreadySelected ? t.hookAlreadySelected : limitReached ? t.hookMax3 : o.title;
                          return { id: o.id, label: o.title, disabled, title };
                        })}
                        onToggle={(id) => {
                          addHookCommand('post', id);
                        }}
                      />
                    );
                  })()}
                </Layout.Row>
                {(() => {
                  const postIds = getSelectedRuleHooks(selected, selectedRuleIndex, 'post');
                  const postItems = postIds.map((id) => ({
                    id,
                    label: savedCommandsForHooks.find((c) => c.id === id)?.title ?? id,
                    title: id,
                  }));
                  if (!postItems.length) return null;
                  return (
                    <Layout.Row align="center" gap={10} style={{ padding: '0 2px', flexWrap: 'wrap' }}>
                      <Layout.Row align="center" gap={6} style={{ opacity: 0.85, flex: 'none' }}>
                        <span>{(t as any).postCommandFull ?? '后置命令'}</span>
                        <Checkbox
                          checked={applyPostHooks}
                          onChange={(v) => setApplyPostHooks(v)}
                          tooltip={(t as any).applyPostHooksTip ?? t.applyPostHooks}
                          ariaLabel={t.applyPostHooks}
                        />
                      </Layout.Row>
                      <HookChipsBar
                        className="hookChipsBottom"
                        title={undefined}
                        items={postItems}
                        onRemove={(id) => removeHookCommand('post', id)}
                        onReorder={(nextIds) => reorderHookCommands('post', nextIds)}
                      />
                    </Layout.Row>
                  );
                })()}
              </div>
            ) : (
              <div style={{ padding: '0 8px 8px', opacity: 0.7 }}>{t.noRuleSelected}</div>
            )}
          </Layout.Content>
          <Layout.Content className="panel">
            <div style={{ padding: 8, opacity: 0.8, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span>{t.testEditor}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Checkbox
                    checked={Boolean(saveTestTextChecked)}
                    tooltip={(t as any).saveTestTextTip ?? ''}
                    ariaLabel={(t as any).saveTestText ?? '保存测试文本'}
                    onChange={(checked) => {
                      if (!selected) return;
                      updateSelectedCommand((cmd) => {
                        const rules = [...cmd.rules];
                        const cur = rules[selectedRuleIndex] as any;
                        if (!cur) return cmd;
                        const nextRule = { ...cur } as any;
                        if (checked) nextRule.testText = uiCache.testText ?? '';
                        else delete nextRule.testText;
                        rules[selectedRuleIndex] = nextRule;
                        return { ...cmd, rules };
                      });
                      setDirty(true);
                    }}
                  />
                  <span style={{ opacity: 0.8, fontSize: 12, userSelect: 'none' }}>
                    {(t as any).saveTestText ?? '保存测试文本'}
                  </span>
                </span>
              </span>
              <span className="testEditorMeta">
                <span>{`${t.matches}: ${matches.length}`}</span>
              </span>
            </div>
            <CodeMirrorTextEditor
              className="editorHost"
              value={testText}
              extensions={testerMatches.cmExtensions}
              onEditorReady={(view) => {
                testEditorRef.current = view;
                setIsTestEditorReady(true);
              }}
              onChange={(v) => {
                setTestText(v);
                if (!saveTestTextChecked) return;
                if (!selected) return;
                updateSelectedCommand((cmd) => {
                  const rules = [...cmd.rules];
                  const cur = rules[selectedRuleIndex] as any;
                  if (!cur) return cmd;
                  if (cur.testText === undefined) return cmd;
                  rules[selectedRuleIndex] = { ...cur, testText: v };
                  return { ...cmd, rules };
                });
                setDirty(true);
              }}
            />
          </Layout.Content>
        </Layout.Content>

        <Splitter
          orientation="horizontal"
          onMouseDown={(e) => {
            attachHorizontalSplitDrag(e, {
              startHeight: layout.toolsHeight,
              min: 160,
              max: 520,
              onResize: (nextH) => setLayout((prev) => ({ ...prev, toolsHeight: nextH })),
            });
          }}
        />

          <Layout.Footer className="toolsDock" style={{ height: layout.toolsHeight }}>
          <div className="toolsTopRow">
            <ReplacementTemplateField
              value={replaceInput}
                  disabled={effectiveReplaceMode === 'map'}
              highlightEnabled={selectedRule?.engine === 'regex'}
              maxCaptureGroupCount={replacementTemplateMaxCaptureGroups}
              onChange={(v) => {
                setReplaceInput(v);
                // 替换模板属于规则配置：同步写回当前规则，确保保存时能落盘到 settings.json
                if (selected?.rules?.[selectedRuleIndex]) {
                  updateSelectedCommand((cmd) => {
                    const rules = [...cmd.rules];
                    const cur = rules[selectedRuleIndex];
                    if (!cur) return cmd;
                    rules[selectedRuleIndex] = { ...cur, replace: v };
                    return { ...cmd, rules };
                  });
                }
              }}
              placeholder={t.replacementTemplate}
            />
            {canReplaceMap ? (
              <Switch
                value={replaceMode}
                ariaLabel="替换模式开关"
                options={[
                  { key: 'template', label: (t as any).replaceModeReplace },
                  { key: 'map', label: (t as any).replaceModeMap },
                ]}
                onChange={(next) => {
                  if (!selected?.rules?.[selectedRuleIndex]) return;
                  updateSelectedCommand((cmd) => {
                    const rules = [...cmd.rules];
                    const cur = rules[selectedRuleIndex] as any;
                    if (!cur) return cmd;
                    const nextRule = { ...cur, replaceMode: next } as any;
                    if (next === 'map' && !nextRule.map) nextRule.map = { mode: 'text', cases: [] };
                    rules[selectedRuleIndex] = nextRule;
                    return { ...cmd, rules };
                  });
                }}
              />
            ) : null}
          </div>

            <div
              className={effectiveReplaceMode === 'map' ? 'toolsSplit' : 'toolsMain'}
              style={
                effectiveReplaceMode === 'map'
                  ? { gridTemplateColumns: `${layout.toolsSplitLeftWidth}px 6px minmax(0, 1fr)` }
                  : undefined
              }
            >
              {effectiveReplaceMode === 'map' ? (
              <div className="toolsSplitLeft">
                <MappingTable
                  map={(selectedRule as any)?.map}
                  uiLanguage={lang}
                  regexFlags={regexPreview?.flags ?? ''}
                  t={{
                    title: (t as any).mappingTableTitle,
                    colMatch: (t as any).mappingColMatch,
                    colReplace: (t as any).mappingColReplace,
                    colExpr: (t as any).mappingColExpr,
                    colTemplate: (t as any).mappingColTemplate,
                    regexModeLabel: (t as any).mappingRegexModeLabel,
                    regexModeTip: (t as any).mappingRegexModeTip,
                    addRow: (t as any).mappingAddRow,
                    deleteRow: (t as any).mappingDeleteRow,
                    duplicateKey: (t as any).mappingDuplicateKey,
                    matchRequired: (t as any).mapMatchRequired,
                    matchHelp: `${(t as any).mappingTableHelpIntro}\n\n${(t as any).mappingTableHelpMatch}\n\n${(t as any).mappingTableHelpReplace}`,
                  }}
                  onChangeMap={(nextMap) => {
                    if (!selected?.rules?.[selectedRuleIndex]) return;
                    updateSelectedCommand((cmd) => {
                      const rules = [...cmd.rules];
                      const cur = rules[selectedRuleIndex] as any;
                      if (!cur) return cmd;
                      rules[selectedRuleIndex] = { ...cur, map: nextMap };
                      return { ...cmd, rules };
                    });
                  }}
                />
              </div>
            ) : null}

            {effectiveReplaceMode === 'map' ? (
              <Splitter
                className="toolsSplitMidSplitter"
                orientation="vertical"
                onMouseDown={(e) => {
                  const hostW = appHostRef.current?.clientWidth ?? window.innerWidth;
                  const minRight = 280;
                  const minLeft = 220;
                  const maxByViewport = Math.max(minLeft, hostW - minRight);
                  const max = Math.min(620, maxByViewport);
                  attachVerticalSplitDrag(e, {
                    startWidth: layout.toolsSplitLeftWidth,
                    min: minLeft,
                    max,
                    onResize: (nextWidth) => setLayout((prev) => ({ ...prev, toolsSplitLeftWidth: nextWidth })),
                  });
                }}
              />
            ) : null}

            <div className={replaceMode === 'map' ? 'toolsSplitRight' : 'toolsMainRight'}>
              <TabBar
                value={toolsTab}
                options={[
                  { value: 'replace', label: t.replaceTab },
                  { value: 'list', label: t.listTab },
                  { value: 'details', label: t.details },
                  { value: 'explain', label: t.explain },
                ]}
                onChange={(key) => setToolsTab(key as ToolsTab)}
                extra={
                  toolsTab === 'replace' || toolsTab === 'list' ? (
                    <Layout.Row align="center" gap={8}>
                      {toolsTab === 'replace' ? (
                        <Tooltip content={t.replaceResultHighlightTip}>
                          <Button
                            preset="chip"
                            className="rrRuleEnableChip"
                            active={replacePreviewHighlight}
                            aria-pressed={replacePreviewHighlight}
                            aria-label={t.replacePreviewHighlightChip}
                            onClick={() => setReplacePreviewHighlight((h) => !h)}
                          >
                            {t.replacePreviewHighlightChip}
                          </Button>
                        </Tooltip>
                      ) : null}
                      <Tooltip content={t.copy}>
                        <Button preset="topIcon" aria-label={t.copy} onClick={() => void copyActiveToolsResult(toolsTab)}>
                          <Icon type="copy" />
                        </Button>
                      </Tooltip>
                    </Layout.Row>
                  ) : null
                }
              />
              <div className="toolsBody">
                {toolsTab === 'replace' ? (
                  <div className="toolsReplaceLayout">
                    <ReplaceResultBox
                      className={toolsPreviewFillClassName}
                      highlightReplaced={replacePreviewHighlight && !applyPostHooks}
                      parts={replacePreview?.parts ?? []}
                      fallbackText={replacePreview?.text ?? ''}
                      emptyText={t.emptyText}
                      replacedCount={replacePreview?.count ?? 0}
                      maxChars={200_000}
                      onTruncated={() => Toast.show(tRef.current.truncated, 'info')}
                    />
                  </div>
                ) : toolsTab === 'list' ? (
                  <div className="toolsReplaceLayout">
                    <ListResultPanel
                      className={toolsPreviewFillClassName}
                      matches={matches}
                      maxItems={20_000}
                      onTruncated={() => Toast.show(tRef.current.truncated, 'info')}
                      onCtrlA={() => Toast.show(tRef.current.useCopyButton, 'info')}
                    />
                  </div>
                ) : toolsTab === 'details' ? (
                  <div className="toolsReplaceLayout">
                    <MatchDetailsPanel
                      className={toolsPreviewFillClassName}
                      engine={selected?.rules?.[selectedRuleIndex]?.engine}
                      flagsDisplay={
                        selected?.rules?.[selectedRuleIndex]?.engine === 'regex'
                          ? (selected.rules[selectedRuleIndex].flags ?? 'g')
                          : t.flagsNa
                      }
                      current={currentMatchIndex !== undefined ? matches[currentMatchIndex] : undefined}
                    />
                  </div>
                ) : (
                  <ExplainTabContent className={toolsPreviewFillClassName} engine={selectedRuleEngine} />
                )}
              </div>
            </div>
          </div>
        </Layout.Footer>
      </Layout.Content>
    </Layout.Client>
  );
}

