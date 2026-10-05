import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorView, ViewUpdate } from '@codemirror/view';
import { Decoration, ViewPlugin } from '@codemirror/view';
import { hoverTooltip } from '@codemirror/view';
import { RangeSetBuilder, StateEffect } from '@codemirror/state';
import { computeMatches, type MatchItem, type ReplaceRule as TesterReplaceRule } from '../features/tester/matchHighlighter';
import { buildMatchTooltipModel, findMatchAtOffset } from '../features/tester/matchTooltip';
import { getMatchIndexByOffset } from '../utils';

export type UseTesterMatchesCmOptions = {
  isReady: boolean;
  viewRef: React.RefObject<EditorView | null>;
  selectedRule: TesterReplaceRule | undefined;
  depsKey: string;
  text: string;
  currentMatchIndex: number | undefined;
  setCurrentMatchIndex: (idx: number | undefined) => void;
  onBeforeRecompute?: () => void;
};

export type UseTesterMatchesCmResult = {
  matches: MatchItem[];
  matchError: string | undefined;
  clearMatches: () => void;
  scheduleCompute: () => void;
  cmExtensions: any[];
};

const forceRefreshDecorationsEffect = StateEffect.define<null>();

/**
 * CodeMirror 版：管理测试区匹配计算、视口内高亮，以及光标到匹配项联动。
 *
 * @param opt 配置项。
 * @returns matches 状态与触发重算的方法，以及编辑器需要挂载的 extensions。
 */
export function useTesterMatchesCm(opt: UseTesterMatchesCmOptions): UseTesterMatchesCmResult {
  const { isReady, selectedRule, depsKey, text, currentMatchIndex, setCurrentMatchIndex, onBeforeRecompute, viewRef } = opt;
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [matchError, setMatchError] = useState<string | undefined>(undefined);

  const computeTokenRef = useRef(0);
  const computeTimerRef = useRef<number | undefined>(undefined);
  const isMountedRef = useRef(true);
  const matchesRef = useRef<MatchItem[]>([]);
  const currentIndexRef = useRef<number | undefined>(undefined);
  const setCurrentIndexRef = useRef(setCurrentMatchIndex);
  const inputRef = useRef({ selectedRule, text, onBeforeRecompute });
  const selectionTokenRef = useRef(0);
  const previousRuleKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      computeTokenRef.current += 1;
      if (computeTimerRef.current) window.clearTimeout(computeTimerRef.current);
      computeTimerRef.current = undefined;
      selectionTokenRef.current += 1;
    };
  }, []);

  // 匹配结果仅在计算完成时发布；React 重渲染不能恢复属于旧文档的结果。
  currentIndexRef.current = currentMatchIndex;
  setCurrentIndexRef.current = setCurrentMatchIndex;
  inputRef.current = { selectedRule, text, onBeforeRecompute };

  /**
   * 主动触发一次 CodeMirror update：用于在“规则变化但文档未变化”时，仍然刷新 decorations。
   *
   * 无入参。
   *
   * @returns 无返回值。
   */
  const forceRefreshDecorations = useCallback((): void => {
    const view = viewRef.current;
    if (!view) return;
    // React effects 可能在 CodeMirror 更新中被同步刷新，延后 dispatch 避免嵌套更新。
    queueMicrotask(() => {
      if (!isMountedRef.current || viewRef.current !== view) return;
      view.dispatch({ effects: forceRefreshDecorationsEffect.of(null) });
    });
  }, [viewRef]);

  const clearMatches = useCallback((): void => {
    computeTokenRef.current += 1;
    if (computeTimerRef.current) window.clearTimeout(computeTimerRef.current);
    computeTimerRef.current = undefined;
    matchesRef.current = [];
    setMatches([]);
    setMatchError(undefined);
    forceRefreshDecorations();
  }, [forceRefreshDecorations]);

  const runCompute = useCallback(
    (token: number): void => {
      if (token !== computeTokenRef.current) return;
      const { selectedRule: rule, text: latestText } = inputRef.current;
      if (!rule) {
        clearMatches();
        return;
      }

      try {
        const items = computeMatches(rule, latestText, { maxMatches: 5000 });
        matchesRef.current = items;
        setMatches(items);
        setMatchError(undefined);
        forceRefreshDecorations();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        matchesRef.current = [];
        setMatches([]);
        setMatchError(msg);
        forceRefreshDecorations();
      }
    },
    [clearMatches, forceRefreshDecorations],
  );

  /**
   * 立即执行一次重算（无 debounce），用于规则/flags 等表达式相关字段变化时的即时反馈。
   *
   * 无入参。
   *
   * @returns 无返回值。
   */
  const computeNow = useCallback((): void => {
    if (computeTimerRef.current) window.clearTimeout(computeTimerRef.current);
    computeTimerRef.current = undefined;
    const token = (computeTokenRef.current += 1);
    inputRef.current.onBeforeRecompute?.();
    runCompute(token);
  }, [runCompute]);

  const scheduleCompute = useCallback((): void => {
    if (computeTimerRef.current) window.clearTimeout(computeTimerRef.current);
    const token = (computeTokenRef.current += 1);
    computeTimerRef.current = window.setTimeout(() => {
      if (token !== computeTokenRef.current) return;
      computeTimerRef.current = undefined;
      inputRef.current.onBeforeRecompute?.();
      runCompute(token);
    }, 200);
  }, [runCompute]);

  // 使用同一个入口区分规则与文本变化，避免文本每次触发立即计算和延迟计算。
  useEffect(() => {
    if (!isReady) {
      previousRuleKeyRef.current = undefined;
      clearMatches();
      return;
    }
    const ruleChanged = previousRuleKeyRef.current !== depsKey;
    previousRuleKeyRef.current = depsKey;
    if (ruleChanged) computeNow();
    else scheduleCompute();
  }, [depsKey, isReady, text, computeNow, scheduleCompute, clearMatches]);

  useEffect(() => {
    forceRefreshDecorations();
  }, [matches, currentMatchIndex, forceRefreshDecorations]);

  const cmExtensions = useMemo(() => {
    const DECORATION_MAX = 1200;
    const plugin = ViewPlugin.fromClass(
      class {
        decorations;
        constructor(view: EditorView) {
          this.decorations = buildDecorations(view, matchesRef.current, currentIndexRef.current, DECORATION_MAX);
        }
        update(update: ViewUpdate) {
          const shouldForceRefresh = update.transactions?.some((tr: any) =>
            tr.effects?.some((e: any) => e.is?.(forceRefreshDecorationsEffect)),
          );
          if (update.docChanged) {
            // 旧匹配属于旧文档，重算前不能用于新文档的高亮或悬浮提示。
            matchesRef.current = [];
          }
          if (update.selectionSet || update.docChanged) {
            const offset = update.state.selection.main.head;
            const idx = getMatchIndexByOffset(matchesRef.current, offset);
            currentIndexRef.current = idx;
            const token = ++selectionTokenRef.current;
            queueMicrotask(() => {
              if (!isMountedRef.current || token !== selectionTokenRef.current) return;
              setCurrentIndexRef.current(idx);
            });
          }
          if (shouldForceRefresh || update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = buildDecorations(update.view, matchesRef.current, currentIndexRef.current, DECORATION_MAX);
          }
        }
      },
      {
        decorations: (v) => v.decorations,
      },
    );
    const matchHover = hoverTooltip((view, pos) => {
      const it = findMatchAtOffset(matchesRef.current, pos);
      if (!it) return null;
      const model = buildMatchTooltipModel(it);
      const dom = buildMatchHoverDom(model);
      return {
        pos: model.startOffset,
        end: model.endOffset,
        above: true,
        strictSide: true,
        create() {
          return { dom };
        },
      };
    });

    return [plugin, matchHover];
  }, []);

  return { matches, matchError, clearMatches, scheduleCompute, cmExtensions };
}

/**
 * 构建“匹配气泡提示”的 DOM 结构：展示 match、range 与捕获组。
 *
 * @param model tooltip 数据模型。
 * @returns tooltip 根节点。
 */
function buildMatchHoverDom(model: { matchText: string; startOffset: number; endOffset: number; groups: string[] }): HTMLDivElement {
  const root = document.createElement('div');
  root.style.padding = '8px 10px';
  root.style.maxWidth = '520px';
  root.style.fontSize = '12px';
  root.style.lineHeight = '1.45';

  const head = document.createElement('div');
  head.style.fontWeight = '600';
  head.textContent = `match: ${model.matchText}`;
  root.appendChild(head);

  const range = document.createElement('div');
  range.style.opacity = '0.85';
  range.textContent = `range: ${model.startOffset}–${model.endOffset}`;
  root.appendChild(range);

  if (model.groups.length > 0) {
    const sep = document.createElement('div');
    sep.style.height = '8px';
    root.appendChild(sep);

    for (let i = 0; i < model.groups.length; i += 1) {
      const g = document.createElement('div');
      g.textContent = `group #${i + 1}: ${model.groups[i] ?? ''}`;
      root.appendChild(g);
    }
  }

  return root;
}

/**
 * 根据当前视口与匹配结果构建 CodeMirror 装饰集合，用于在测试区高亮匹配片段。
 *
 * @param view CodeMirror 视图实例。
 * @param matches 匹配列表（按 offset 升序）。
 * @param currentMatchIndex 当前激活的匹配索引（用于高亮区分）。
 * @param maxCount 最多渲染的高亮数量（防止超大输入导致性能下降）。
 * @returns CodeMirror 的 decoration rangeset。
 */
function buildDecorations(
  view: EditorView,
  matches: MatchItem[],
  currentMatchIndex: number | undefined,
  maxCount: number,
) {
  const from = view.viewport.from;
  const to = view.viewport.to;
  const builder = new RangeSetBuilder<Decoration>();
  let count = 0;
  for (const it of matches) {
    if (it.endOffset <= it.startOffset || it.startOffset < 0 || it.endOffset > view.state.doc.length) continue;
    if (it.endOffset <= from) continue;
    if (it.startOffset >= to) break;
    const isCurrent = currentMatchIndex !== undefined && it.index === currentMatchIndex;
    const deco = Decoration.mark({ class: isCurrent ? 'regexpReplacerMatchActive' : 'regexpReplacerMatch' });
    builder.add(it.startOffset, it.endOffset, deco);
    count += 1;
    if (count >= maxCount) break;
  }
  return builder.finish();
}

