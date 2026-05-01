import { useEffect, useRef } from 'react';
import type { ReplaceCommand } from '../../../../../../src/types';
import type { WebviewResponse } from '../../../bridge/vscodeApi';
import { normalizeCommandTitles, sanitizeCommandsPayload, isPristineUntitledDraft, isUntitledCommandTitle } from '../../../utils';

export type MessageRouterDeps = {
  /**
   * vscodeApi：用于向扩展侧请求配置与落盘保存。
   */
  vscodeApi: { postMessage: (msg: any) => void };
  /**
   * i18n：未命名命令标题（从 ref 获取，避免闭包读取旧值）。
   */
  getUntitledTitle: () => string;
  /**
   * state setters。
   */
  setCommands: React.Dispatch<React.SetStateAction<ReplaceCommand[]>>;
  setSelectedId: (id: string) => void;
  setSelectedRuleIndex: (idx: number) => void;
  setDirty: (dirty: boolean) => void;
  /**
   * 当前命令列表（用于触发 pending 队列刷新）。
   */
  commands: ReplaceCommand[];
  /**
   * refs：用于跨异步回调的最新值读取/写回。
   */
  commandsRef: React.MutableRefObject<ReplaceCommand[]>;
  selectedIdRef: React.MutableRefObject<string | undefined>;
  savedSnapshotRef: React.MutableRefObject<ReplaceCommand[] | null>;
  pendingAutoSelectIdRef: React.MutableRefObject<string | undefined>;
  pendingAutoSelectRuleIndexRef: React.MutableRefObject<number | null>;
  pendingAutoSavePayloadRef: React.MutableRefObject<ReplaceCommand[] | null>;
  autoCreatedRef: React.MutableRefObject<boolean>;
  initialUntitledEnsuredRef: React.MutableRefObject<boolean>;
  draftIdRef: React.MutableRefObject<string | undefined>;
  /**
   * 创建未命名草稿命令（仅首次打开面板自动补回）。
   */
  createDraftCommand: (untitledTitle: string) => ReplaceCommand;
};

/**
 * App 级 message 路由：负责监听来自扩展侧的 message（尤其是 config 回包），并把回包策略内聚，
 * 同时处理 pendingAutoSelect/pendingAutoSave 的队列式刷新（避免在任意地方散落 setTimeout/副作用）。
 *
 * @param deps 依赖注入（setters、refs、vscodeApi、草稿创建与 i18n）。
 * @returns 无返回值。
 */
export function useMessageRouter(deps: MessageRouterDeps): void {
  const {
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
  } = deps;

  const getUntitledTitleRef = useRef(getUntitledTitle);
  useEffect(() => {
    getUntitledTitleRef.current = getUntitledTitle;
  }, [getUntitledTitle]);

  useEffect(() => {
    const onMessage = (ev: MessageEvent<WebviewResponse>) => {
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type !== 'config') return;

      const list = sanitizeCommandsPayload((msg as any).payload);
      autoCreatedRef.current = true;
      savedSnapshotRef.current = structuredClone(list) as ReplaceCommand[];

      const untitledTitle = getUntitledTitleRef.current();
      const normalized = normalizeCommandTitles(list, untitledTitle);

      const next = (() => {
        const isFirstConfig = !initialUntitledEnsuredRef.current;
        if (isFirstConfig) initialUntitledEnsuredRef.current = true;

        const existingDraft = commandsRef.current.find((c) => isPristineUntitledDraft(c));
        if (existingDraft) return [existingDraft, ...normalized.filter((c) => c.id !== existingDraft.id)];

        if (isFirstConfig) {
          const hasAnyUntitled = normalized.some((c) => isUntitledCommandTitle(c.title));
          if (!hasAnyUntitled) {
            const draft = createDraftCommand(untitledTitle);
            draftIdRef.current = draft.id;
            return [draft, ...normalized];
          }
        }

        return normalized;
      })();

      // 保存后回包不含侧栏未落盘的未命名卡；若此处不合并，会覆盖掉 doSaveFrom 刚保留在 ref 中的条目。
      const missingUntitled = commandsRef.current.filter(
        (c) => isUntitledCommandTitle(c.title) && !next.some((n) => n.id === c.id),
      );
      const mergedNext = missingUntitled.length > 0 ? [...missingUntitled, ...next] : next;

      setCommands(mergedNext);
      if (mergedNext.length > 0) {
        const current = selectedIdRef.current;
        const stillExists = current ? mergedNext.some((c) => c.id === current) : false;
        if (!current || !stillExists) setSelectedId(mergedNext[0].id);
      }
    };

    window.addEventListener('message', onMessage);
    vscodeApi.postMessage({ type: 'getConfig' });
    return () => window.removeEventListener('message', onMessage);
  }, [autoCreatedRef, commandsRef, createDraftCommand, draftIdRef, initialUntitledEnsuredRef, savedSnapshotRef, selectedIdRef, setCommands, setSelectedId, vscodeApi]);

  useEffect(() => {
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

    const payload = pendingAutoSavePayloadRef.current;
    if (payload) {
      pendingAutoSavePayloadRef.current = null;
      vscodeApi.postMessage({ type: 'setConfig', payload });
      setDirty(false);
      savedSnapshotRef.current = structuredClone(payload) as ReplaceCommand[];
    }
  }, [commands, vscodeApi]);
}

