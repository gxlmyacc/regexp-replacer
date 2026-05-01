import { useCallback, useEffect, useRef } from 'react';

export type UseCommandSelectionDeps = {
  /**
   * 当前选中命令 id（state）。
   */
  selectedId: string | undefined;
  /**
   * 设置选中命令 id（state setter）。
   */
  setSelectedId: (id: string) => void;
  /**
   * 设置选中规则索引（state setter）。
   */
  setSelectedRuleIndex: (idx: number) => void;
};

export type CommandSelectionApi = {
  /**
   * 同步 ref：用于在异步回调中读取最新选中 id。
   */
  selectedIdRef: React.MutableRefObject<string | undefined>;
  /**
   * 延迟自动选中的命令 id（写入后会在 effect 中消费）。
   */
  pendingAutoSelectIdRef: React.MutableRefObject<string | undefined>;
  /**
   * 延迟自动选中的规则索引（写入后会在 effect 中消费）。
   */
  pendingAutoSelectRuleIndexRef: React.MutableRefObject<number | null>;
  /**
   * 请求延迟自动选择某个命令（并把 ruleIndex 归零）。
   *
   * @param id 命令 id。
   * @returns 无返回值。
   */
  requestAutoSelectCommand: (id: string) => void;
  /**
   * 请求延迟自动选择某条规则索引（仅更新 ruleIndex）。
   *
   * @param idx 规则索引。
   * @returns 无返回值。
   */
  requestAutoSelectRuleIndex: (idx: number) => void;
};

/**
 * 命令选择管理 hook：集中管理 selectedIdRef 与“延迟自动选择”队列（避免分散在 App.tsx 里）。
 *
 * @param deps 依赖注入（selectedId 与 setters）。
 * @returns selection 相关 refs 与请求方法。
 */
export function useCommandSelection(deps: UseCommandSelectionDeps): CommandSelectionApi {
  const { selectedId, setSelectedId, setSelectedRuleIndex } = deps;

  const selectedIdRef = useRef<string | undefined>(undefined);
  const pendingAutoSelectIdRef = useRef<string | undefined>(undefined);
  const pendingAutoSelectRuleIndexRef = useRef<number | null>(null);
  const consumeTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  /**
   * 消费 pending 队列：若存在延迟选择请求，则按约定更新 selectedId / ruleIndex。
   *
   * - 命令选择：会把 ruleIndex 归零。
   * - 规则选择：仅更新 ruleIndex。
   *
   * @returns 无返回值。
   */
  const consumePending = useCallback((): void => {
    const nextSelectedId = pendingAutoSelectIdRef.current;
    if (nextSelectedId !== undefined) {
      pendingAutoSelectIdRef.current = undefined;
      setSelectedId(nextSelectedId);
      setSelectedRuleIndex(0);
    }

    const nextRuleIndex = pendingAutoSelectRuleIndexRef.current;
    if (nextRuleIndex !== null) {
      pendingAutoSelectRuleIndexRef.current = null;
      setSelectedRuleIndex(nextRuleIndex);
    }
  }, [setSelectedId, setSelectedRuleIndex]);

  /**
   * 安排一次异步消费：用于在“调用方在 effect 中写入 pending”时，也能在下一拍被消费。
   *
   * @returns 无返回值。
   */
  const scheduleConsume = useCallback((): void => {
    if (consumeTimerRef.current) return;
    consumeTimerRef.current = window.setTimeout(() => {
      consumeTimerRef.current = undefined;
      consumePending();
    }, 0);
  }, [consumePending]);

  useEffect(() => {
    consumePending();
  });

  useEffect(() => {
    return () => {
      if (consumeTimerRef.current) window.clearTimeout(consumeTimerRef.current);
      consumeTimerRef.current = undefined;
    };
  }, []);

  const requestAutoSelectCommand = useCallback(
    (id: string): void => {
      pendingAutoSelectIdRef.current = id;
      scheduleConsume();
    },
    [scheduleConsume],
  );

  const requestAutoSelectRuleIndex = useCallback(
    (idx: number): void => {
      pendingAutoSelectRuleIndexRef.current = idx;
      scheduleConsume();
    },
    [scheduleConsume],
  );

  return {
    selectedIdRef,
    pendingAutoSelectIdRef,
    pendingAutoSelectRuleIndexRef,
    requestAutoSelectCommand,
    requestAutoSelectRuleIndex,
  };
}

