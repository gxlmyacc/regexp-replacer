import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildRuleKey } from '../utils';

export type ToolsTab = 'replace' | 'list' | 'details' | 'explain';

export type RuleUiCache = {
  testText: string;
  replaceTemplate: string;
  toolsTab: ToolsTab;
  currentMatchIndex?: number;
  listScrollTop: number;
  applyPreHooks: boolean;
  applyPostHooks: boolean;
  applyPrevRules: boolean;
};

export type UseRuleUiCacheOptions = {
  isReady: boolean;
  selectedCmdId?: string;
  selectedRuleIndex: number;
  selectedRuleUid?: string;
  getDefaultReplaceTemplate: (cmdId: string, ruleIndex: number) => string;
  getDefaultTestText: (cmdId: string, ruleIndex: number) => string;
  onRestore: () => void;
};

export type UseRuleUiCacheResult = {
  testText: string;
  setTestText: (value: string) => void;
  replaceInput: string;
  setReplaceInput: (value: string) => void;
  toolsTab: ToolsTab;
  setToolsTab: (tab: ToolsTab) => void;
  listScrollTop: number;
  setListScrollTop: (v: number) => void;
  currentMatchIndex: number | undefined;
  setCurrentMatchIndex: (v: number | undefined) => void;
  applyPreHooks: boolean;
  setApplyPreHooks: (v: boolean) => void;
  applyPostHooks: boolean;
  setApplyPostHooks: (v: boolean) => void;
  applyPrevRules: boolean;
  setApplyPrevRules: (v: boolean) => void;
  testTextVersion: number;
  primeRuleCache: (cmdId: string, ruleIndex: number, ruleUid: string, init?: Partial<RuleUiCache>) => void;
};

/**
 * 管理“按（命令 + 规则）隔离”的 UI 临时态缓存：测试文本、替换模板、激活页签等。
 *
 * @param opt 配置项。
 * @returns UI 状态与操作方法。
 */
export function useRuleUiCache(opt: UseRuleUiCacheOptions): UseRuleUiCacheResult {
  const { isReady, selectedCmdId, selectedRuleIndex, selectedRuleUid, getDefaultReplaceTemplate, getDefaultTestText, onRestore } = opt;

  const cacheRef = useRef<Record<string, RuleUiCache>>({});
  const lastKeyRef = useRef<string | null>(null);
  const currentKeyRef = useRef<string | null>(null);
  const isRestoringRef = useRef(false);

  const [toolsTab, setToolsTab] = useState<ToolsTab>('replace');
  const [replaceInput, setReplaceInput] = useState('');
  const [listScrollTop, setListScrollTop] = useState(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number | undefined>(undefined);
  const [testText, setTestTextState] = useState('');
  const [applyPreHooks, setApplyPreHooks] = useState(false);
  const [applyPostHooks, setApplyPostHooks] = useState(false);
  const [applyPrevRules, setApplyPrevRules] = useState(false);
  const [testTextVersion, setTestTextVersion] = useState(0);

  const getOrCreate = useCallback(
    (ruleKey: string, fallback: Omit<RuleUiCache, 'testText'> & { testText?: string }): RuleUiCache => {
      const existing = cacheRef.current[ruleKey];
      if (existing) return existing;
      const created: RuleUiCache = {
        testText: fallback.testText ?? '',
        replaceTemplate: fallback.replaceTemplate,
        toolsTab: fallback.toolsTab,
        currentMatchIndex: fallback.currentMatchIndex,
        listScrollTop: fallback.listScrollTop,
        applyPreHooks: fallback.applyPreHooks ?? false,
        applyPostHooks: fallback.applyPostHooks ?? false,
        applyPrevRules: fallback.applyPrevRules ?? false,
      };
      cacheRef.current[ruleKey] = created;
      return created;
    },
    [],
  );

  const setTestText = useCallback((value: string): void => {
    setTestTextState(value);
    setTestTextVersion((v) => v + 1);
  }, []);

  const primeRuleCache = useCallback(
    (cmdId: string, ruleIndex: number, ruleUid: string, init?: Partial<RuleUiCache>): void => {
      const key = buildRuleKey(cmdId, ruleUid);
      const existing = cacheRef.current[key];
      if (existing) return;
      cacheRef.current[key] = {
        testText: init?.testText ?? '',
        replaceTemplate: init?.replaceTemplate ?? '',
        toolsTab: init?.toolsTab ?? 'replace',
        currentMatchIndex: init?.currentMatchIndex,
        listScrollTop: init?.listScrollTop ?? 0,
        applyPreHooks: init?.applyPreHooks ?? false,
        applyPostHooks: init?.applyPostHooks ?? false,
        applyPrevRules: init?.applyPrevRules ?? false,
      };
    },
    [],
  );

  const selectionKey = useMemo(() => {
    if (!selectedCmdId || !selectedRuleUid) return null;
    return buildRuleKey(selectedCmdId, selectedRuleUid);
  }, [selectedCmdId, selectedRuleUid]);

  useEffect(() => {
    if (!isReady || !selectedCmdId || !selectionKey) return;

    const prevKey = lastKeyRef.current;

    // 保存上一条选择的临时态
    if (prevKey && prevKey !== selectionKey) {
      const prevCache = getOrCreate(prevKey, {
        replaceTemplate: replaceInput,
        toolsTab,
        currentMatchIndex,
        listScrollTop,
        testText,
        applyPreHooks,
        applyPostHooks,
        applyPrevRules,
      });
      prevCache.testText = testText;
      prevCache.replaceTemplate = replaceInput;
      prevCache.toolsTab = toolsTab;
      prevCache.currentMatchIndex = currentMatchIndex;
      prevCache.listScrollTop = listScrollTop;
      prevCache.applyPreHooks = applyPreHooks;
      prevCache.applyPostHooks = applyPostHooks;
      prevCache.applyPrevRules = applyPrevRules;
    }

    // 恢复当前选择的临时态
    if (prevKey !== selectionKey) {
      const nextCache = getOrCreate(selectionKey, {
          testText: getDefaultTestText(selectedCmdId, selectedRuleIndex),
        replaceTemplate: getDefaultReplaceTemplate(selectedCmdId, selectedRuleIndex),
        toolsTab: 'replace',
        currentMatchIndex: undefined,
        listScrollTop: 0,
        applyPreHooks: false,
        applyPostHooks: false,
        applyPrevRules: false,
      });

      isRestoringRef.current = true;
      try {
        setTestTextState(nextCache.testText ?? '');
        setReplaceInput(nextCache.replaceTemplate ?? '');
        setToolsTab(nextCache.toolsTab ?? 'replace');
        setListScrollTop(nextCache.listScrollTop ?? 0);
        setCurrentMatchIndex(nextCache.currentMatchIndex);
        setApplyPreHooks(Boolean(nextCache.applyPreHooks));
        setApplyPostHooks(Boolean(nextCache.applyPostHooks));
        setApplyPrevRules(Boolean(nextCache.applyPrevRules));
        onRestore();
      } finally {
        isRestoringRef.current = false;
      }
    }

    lastKeyRef.current = selectionKey;
    currentKeyRef.current = selectionKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  // 持续写回：当测试文本变化时，把文本写回当前 cache
  useEffect(() => {
    const key = currentKeyRef.current;
    if (!isReady || !key) return;
    if (isRestoringRef.current) return;

    const cache = getOrCreate(key, {
      replaceTemplate: replaceInput,
      toolsTab,
      currentMatchIndex,
      listScrollTop,
      applyPreHooks,
      applyPostHooks,
      applyPrevRules,
    });
    cache.testText = testText;
    cache.applyPreHooks = applyPreHooks;
    cache.applyPostHooks = applyPostHooks;
    cache.applyPrevRules = applyPrevRules;
  }, [isReady, testTextVersion, testText, replaceInput, toolsTab, currentMatchIndex, listScrollTop, applyPreHooks, applyPostHooks, applyPrevRules, getOrCreate]);

  return {
    testText,
    setTestText,
    replaceInput,
    setReplaceInput,
    toolsTab,
    setToolsTab,
    listScrollTop,
    setListScrollTop,
    currentMatchIndex,
    setCurrentMatchIndex,
    applyPreHooks,
    setApplyPreHooks,
    applyPostHooks,
    setApplyPostHooks,
    applyPrevRules,
    setApplyPrevRules,
    testTextVersion,
    primeRuleCache,
  };
}

