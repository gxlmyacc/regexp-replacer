import React, { memo, useEffect, useMemo, useRef } from 'react';
import {
  Decoration,
  EditorView,
  hoverTooltip,
  keymap,
  placeholder,
  tooltips,
  ViewPlugin,
  WidgetType,
  type Tooltip,
  type ViewUpdate,
} from '@codemirror/view';
import { Compartment, EditorState, RangeSetBuilder } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { tokenizeRegexPattern, type RegexTokenType } from '../utils';
import { collectBracketPairs } from '../utils/regexLint/internal/collectBracketPairs';
import { scanRegexCaptureDecorHints } from '../utils/regexLint/internal/scanRegexCaptureDecorHints';
import { collectRegexExpressionDiagnostics, pickDiagnosticAtPosition } from '../utils/regexExpressionDiagnostics';
import type { LanguageCode } from '../i18n';
import './RegexExpressionEditor.scss';

/**
 * 捕获组序号的内联 Widget：占布局宽度、样式贴近 VS Code inlay hint，不写入 doc。
 */
class CaptureIndexInlayWidget extends WidgetType {
  /**
   * @param index 捕获组 1-based 编号。
   */
  constructor(readonly index: number) {
    super();
  }

  /**
   * 判断是否与另一 Widget 等价，用于避免无意义的 DOM 重建。
   *
   * @param other 另一 Widget 实例。
   * @returns 编号相同则为 true。
   */
  eq(other: CaptureIndexInlayWidget): boolean {
    return other.index === this.index;
  }

  /**
   * 渲染为带样式的 span（类名由 SCSS 控制）。
   *
   * @returns 根 DOM 节点。
   */
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'rrRegexCaptureInlay';
    span.textContent = String(this.index);
    return span;
  }

  /**
   * 忽略指向该 Widget 的事件，使点击/拖拽命中两侧真实字符。
   *
   * @returns 恒为 true。
   */
  ignoreEvent(): boolean {
    return true;
  }
}

export type RegexExpressionEditorProps = {
  value: string;
  placeholder?: string;
  uiLanguage: LanguageCode;
  /** 与 `new RegExp(pattern, flags)` 一致的 flags；缺省为空字符串。 */
  regexFlags?: string;
  onChange: (value: string) => void;
  /** 输入后触发一次重算（上游可做 debounce，此处按需每次触发）。 */
  onAfterChange: () => void;
  /** 编辑器失焦时触发（可选；用于映射表等场景的校验提示）。 */
  onBlur?: () => void;
};

/**
 * 正则表达式编辑器（CodeMirror 版）：token/括号/捕获序号装饰 + regexLint 诊断下划线与悬浮提示。
 *
 * @param props 组件属性；其中 `onBlur` 可选，在编辑器失焦时触发（例如映射表行内校验）。
 * @returns React 元素。
 */
export const RegexExpressionEditor = memo(function RegexExpressionEditor(props: RegexExpressionEditorProps): React.ReactElement {
  const { value, placeholder: ph, uiLanguage, regexFlags = '', onChange, onAfterChange, onBlur } = props;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastValueRef = useRef<string>(value ?? '');
  const isApplyingValueRef = useRef(false);
  const extCompartmentRef = useRef<Compartment | null>(null);

  /**
   * 将文本归一化为“单行输入”的形式（去除换行），避免 paste/输入法带来多行。
   *
   * @param raw 原始文本。
   * @returns 归一化后的文本。
   */
  function normalizeSingleLine(raw: string): string {
    return String(raw ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n').replaceAll('\n', '');
  }

  const baseExtensions = useMemo(() => {
    const vscodeTheme = EditorView.theme(
      {
        '&': {
          minHeight: '26px',
          width: '100%',
          boxSizing: 'border-box',
          background: 'var(--vscode-input-background, var(--rr-input-background))',
          color: 'var(--vscode-input-foreground, var(--rr-input-foreground))',
          border: '1px solid var(--vscode-input-border, var(--rr-input-border))',
          borderRadius: '4px',
          outline: 'none',
          fontFamily: 'var(--vscode-editor-font-family, Consolas, monospace)',
          fontSize: 'var(--rr-editor-font-size)',
        },
        '&.cm-focused': {
          borderColor: 'var(--rr-focus-border, var(--rr-input-focused-border))',
        },
        '.cm-scroller': {
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: '1.4',
        },
        '.cm-content': {
          padding: '6px 8px',
          caretColor: 'var(--vscode-editorCursor-foreground, var(--rr-foreground))',
        },
        '.cm-line': {
          paddingLeft: '0',
          paddingRight: '0',
        },
        '.cm-cursor': {
          borderLeftColor: 'var(--vscode-editorCursor-foreground, var(--rr-foreground))',
        },
        '.cm-selectionBackground, .cm-content ::selection': {
          backgroundColor:
            'var(--vscode-editor-selectionBackground, var(--rr-list-activeSelectionBackground, rgba(0, 120, 212, 0.35)))',
        },
      },
      { dark: true },
    );

    const updateListener = EditorView.updateListener.of((u: ViewUpdate) => {
      if (!u.docChanged) return;
      if (isApplyingValueRef.current) return;
      const nextRaw = u.state.doc.toString();
      const next = normalizeSingleLine(nextRaw);
      lastValueRef.current = next;
      onChange(next);
      onAfterChange();
    });

    const blurHandlers = onBlur
      ? EditorView.domEventHandlers({
          blur: () => {
            onBlur();
            return false;
          },
        })
      : [];

    const tokenHighlight = ViewPlugin.fromClass(
      class {
        decorations;
        /**
         * 初始化装饰（token、括号、inlay、诊断）。
         *
         * @param view 编辑器视图。
         */
        constructor(view: EditorView) {
          this.decorations = buildRegexTokenDecorations(view);
        }
        /**
         * 文档/视口/选区/焦点变化时重建装饰。
         *
         * @param update CodeMirror 视图更新描述。
         * @returns 无返回值。
         */
        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged || update.selectionSet || update.focusChanged) {
            this.decorations = buildRegexTokenDecorations(update.view);
          }
          if (update.selectionSet) {
            const text = update.state.doc.toString();
            const cursorOffset = update.state.selection.main.head;
            const pairs = collectBracketPairs(text);
            const nearest = findNearestActiveBracketPair(text, cursorOffset);
            const activeOffsets = nearest ? [nearest.openOffset, nearest.closeOffset] : [];
            logRegexDebug('selectionSet', {
              cursorOffset,
              activeOffsets,
              nearestDepth: nearest?.depth,
              nearestKind: nearest?.kind,
              pairCount: pairs.length,
            });
          }
        }
      },
      {
        decorations: (v) => v.decorations,
      },
    );

    /**
     * 基于当前 doc 生成 decorations（按 token 类型加 class）。
     *
     * @param view 编辑器视图。
     * @returns decorations。
     */
    function buildRegexTokenDecorations(view: EditorView) {
      const text = view.state.doc.toString();
      const tokens = tokenizeRegexPattern(text);
      const builder = new RangeSetBuilder<Decoration>();
      const bracketMetaByOffset = collectBracketMetaByOffset(text);
      const decorHints = scanRegexCaptureDecorHints(text);
      const cursorHead = view.hasFocus ? view.state.selection.main.head : -1;
      const activePair = findNearestActiveBracketPair(text, cursorHead);
      const activeBracketOffsets = activePair ? new Set<number>([activePair.openOffset, activePair.closeOffset]) : new Set<number>();
      const activeInnerRange = activePair ? { from: activePair.openOffset, to: activePair.closeOffset + 1 } : undefined;
      const pendingDecos: { from: number; to: number; deco: Decoration }[] = [];

      /**
       * 暂存 mark 装饰，最后与 Widget 合并排序后写入 RangeSet。
       *
       * @param from 起始偏移（含）。
       * @param to 结束偏移（不含）。
       * @param className 样式类名。
       * @returns 无返回值。
       */
      function pushMark(from: number, to: number, className: string): void {
        if (to <= from) return;
        pendingDecos.push({ from, to, deco: Decoration.mark({ class: className }) });
      }

      /**
       * 在捕获组开括号之后插入占宽序号 Widget（`side: -1` 贴近 `(`）。
       *
       * @param pos 插入位置（一般为 `openOffset + 1`）。
       * @param index 捕获组 1-based 编号。
       * @returns 无返回值。
       */
      function pushCaptureInlay(pos: number, index: number): void {
        pendingDecos.push({
          from: pos,
          to: pos,
          deco: Decoration.widget({
            widget: new CaptureIndexInlayWidget(index),
            side: -1,
            block: false,
          }),
        });
      }

      if (activeInnerRange) {
        const level = levelFromDepth(activePair?.depth ?? 1);
        pushMark(
          activeInnerRange.from,
          activeInnerRange.to,
          `rrRegexTok rrRegexTok--pair-active-range rrRegexTok--pair-active-range-l${level}`,
        );
      }

      /**
       * 判断半开区间 [tFrom,tTo) 是否完全落在某一命名捕获组前缀区间内。
       *
       * @param tFrom 起始偏移（含）。
       * @param tTo 结束偏移（不含）。
       * @returns 被某前缀区间完全包含时为 true。
       */
      function tokenFullyInsideNamedHeader(tFrom: number, tTo: number): boolean {
        return decorHints.namedGroupHeaderRanges.some((h) => tFrom >= h.from && tTo <= h.to);
      }

      for (const hdr of decorHints.namedGroupHeaderRanges) {
        const meta = bracketMetaByOffset.get(hdr.from);
        const level = meta ? levelFromDepth(meta.depth) : 1;
        pushMark(
          hdr.from,
          hdr.to,
          `rrRegexTok rrRegexTok--group rrRegexTok--group-l${level} rrRegexTok--named-group-header`,
        );
      }

      let offset = 0;
      for (const tok of tokens) {
        const len = tok.value.length;
        if (len <= 0) continue;
        const from = offset;
        const to = offset + len;
        offset = to;
        if (tok.type === 'text') continue;
        if (tok.type === 'group') {
          for (let i = 0; i < tok.value.length; i += 1) {
            const ch = tok.value[i];
            if (ch !== '(' && ch !== ')') continue;
            const charFrom = from + i;
            const charTo = charFrom + 1;
            const meta = bracketMetaByOffset.get(charFrom);
            if (!meta) continue;
            const skipBaseForNamedOpen = ch === '(' && decorHints.namedGroupHeaderRanges.some((h) => h.from === charFrom);
            if (!skipBaseForNamedOpen) {
              pushMark(charFrom, charTo, classForBracketDepth(meta.kind, meta.depth));
            }
            if (activeBracketOffsets.has(charFrom)) pushMark(charFrom, charTo, 'rrRegexTok rrRegexTok--pair-active');
          }
          continue;
        }
        if (tok.type === 'class' || tok.type === 'quant') {
          if (!tokenFullyInsideNamedHeader(from, to)) {
            pushMark(from, to, classForToken(tok.type));
          }
          for (let i = 0; i < tok.value.length; i += 1) {
            const ch = tok.value[i];
            if (ch !== '[' && ch !== ']' && ch !== '{' && ch !== '}') continue;
            const charFrom = from + i;
            const meta = bracketMetaByOffset.get(charFrom);
            if (meta) {
              pushMark(charFrom, charFrom + 1, classForBracketDepth(meta.kind, meta.depth));
            }
            if (!activeBracketOffsets.has(charFrom)) continue;
            pushMark(charFrom, charFrom + 1, 'rrRegexTok rrRegexTok--pair-active');
          }
          continue;
        }
        if (!tokenFullyInsideNamedHeader(from, to)) {
          pushMark(from, to, classForToken(tok.type));
        }
      }
      const diagnostics = collectRegexExpressionDiagnostics(text, regexFlags, uiLanguage);
      for (const d of diagnostics) {
        pushMark(
          d.from,
          d.to,
          `rrRegexTok rrRegexTok--diagnostic-underline rrRegexTok--severity-${d.severity}`,
        );
      }
      for (const c of decorHints.capturingOpens) {
        const pos = c.openOffset + 1;
        if (pos <= text.length) {
          pushCaptureInlay(pos, c.index);
        }
      }
      pendingDecos
        .sort((a, b) => (a.from === b.from ? a.to - b.to : a.from - b.from))
        .forEach((item) => builder.add(item.from, item.to, item.deco));
      return builder.finish();
    }

    /**
     * 根据 token 类型返回用于样式的 className。
     *
     * @param type token 类型。
     * @returns className。
     */
    function classForToken(type: RegexTokenType): string {
      if (type === 'escape') return 'rrRegexTok rrRegexTok--escape';
      if (type === 'class') return 'rrRegexTok rrRegexTok--class';
      if (type === 'group') return 'rrRegexTok rrRegexTok--group';
      if (type === 'quant') return 'rrRegexTok rrRegexTok--quant';
      if (type === 'alt') return 'rrRegexTok rrRegexTok--alt';
      if (type === 'anchor') return 'rrRegexTok rrRegexTok--anchor';
      return 'rrRegexTok rrRegexTok--dot';
    }

    /**
     * 根据分组层级返回括号装饰类名（超过 6 层后循环使用配色）。
     *
     * @param kind 圆括号 / 方括号 / 花括号。
     * @param depth 当前括号层级（从 1 开始）。
     * @returns className。
     */
    function classForBracketDepth(kind: 'round' | 'square' | 'curly', depth: number): string {
      const level = levelFromDepth(depth);
      if (kind === 'round') return `rrRegexTok rrRegexTok--group rrRegexTok--group-l${level}`;
      return `rrRegexTok rrRegexTok--bracket rrRegexTok--bracket-l${level}`;
    }

    /**
     * 将任意层级映射到 1..6 的循环色阶。
     *
     * @param depth 原始层级（从 1 开始）。
     * @returns 色阶编号（1..6）。
     */
    function levelFromDepth(depth: number): number {
      return ((Math.max(depth, 1) - 1) % 6) + 1;
    }

    /**
     * 根据光标偏移查找「最近层级」的括号对（支持 ()、[]、{}）。
     *
     * @param text 正则文本。
     * @param cursorOffset 光标偏移。
     * @returns 最近层级的括号对；若未命中则返回 undefined。
     */
    function findNearestActiveBracketPair(
      text: string,
      cursorOffset: number,
    ): { openOffset: number; closeOffset: number; depth: number; kind: 'round' | 'square' | 'curly' } | undefined {
      const pairs = collectBracketPairs(text);
      let nearest: { openOffset: number; closeOffset: number; depth: number; kind: 'round' | 'square' | 'curly' } | undefined;
      for (const pair of pairs) {
        if (!(pair.openOffset < cursorOffset && cursorOffset <= pair.closeOffset)) continue;
        const span = pair.closeOffset - pair.openOffset;
        const nearestSpan = nearest ? nearest.closeOffset - nearest.openOffset : Number.MAX_SAFE_INTEGER;
        if (!nearest || pair.depth > nearest.depth || (pair.depth === nearest.depth && span < nearestSpan)) nearest = pair;
      }
      return nearest;
    }

    /**
     * 构建括号偏移到层级的映射，用于按层级上色。
     *
     * @param text 正则文本。
     * @returns key 为括号偏移、value 为层级的映射。
     */
    function collectBracketMetaByOffset(text: string): Map<number, { kind: 'round' | 'square' | 'curly'; depth: number }> {
      const out = new Map<number, { kind: 'round' | 'square' | 'curly'; depth: number }>();
      const pairs = collectBracketPairs(text);
      for (const pair of pairs) {
        out.set(pair.openOffset, { kind: pair.kind, depth: pair.depth });
        out.set(pair.closeOffset, { kind: pair.kind, depth: pair.depth });
      }
      return out;
    }

    /**
     * 输出正则编辑器调试日志（仅在本地开启 `localStorage.rr.regex.debug=1` 时生效）。
     *
     * @param tag 日志标签。
     * @param payload 日志内容。
     * @returns 无返回值。
     */
    function logRegexDebug(tag: string, payload: Record<string, unknown>): void {
      try {
        if (globalThis.localStorage?.getItem('rr.regex.debug') !== '1') return;
      } catch {
        return;
      }
      console.debug('[RegexExpressionEditor]', tag, payload);
    }

    /**
     * 基于诊断信息提供悬浮提示（命中诊断区间时展示 Tooltip）。
     *
     * @returns CodeMirror 扩展（hoverTooltip）。
     */
    function createDiagnosticsHoverTooltip() {
      return hoverTooltip((view, pos): Tooltip | null => {
        const text = view.state.doc.toString();
        const diagnostics = collectRegexExpressionDiagnostics(text, regexFlags, uiLanguage);
        const hit = pickDiagnosticAtPosition(diagnostics, pos);
        if (!hit) return null;
        return {
          pos: hit.from,
          end: hit.to,
          above: true,
          create() {
            const dom = document.createElement('div');
            dom.className = 'rrRegexTooltip';
            dom.textContent = hit.message;
            return { dom };
          },
        };
      });
    }

    return [
      tooltips({ parent: document.body }),
      history(),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      ph ? placeholder(ph) : [],
      EditorView.lineWrapping,
      vscodeTheme,
      tokenHighlight,
      createDiagnosticsHoverTooltip(),
      updateListener,
      blurHandlers,
    ];
  }, [onAfterChange, onBlur, onChange, ph, regexFlags, uiLanguage]);

  useEffect(() => {
    if (!hostRef.current) return;
    if (viewRef.current) return;

    const extCompartment = new Compartment();
    extCompartmentRef.current = extCompartment;
    const state = EditorState.create({
      doc: normalizeSingleLine(value ?? ''),
      extensions: [extCompartment.of(baseExtensions)],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    const extCompartment = extCompartmentRef.current;
    if (!view || !extCompartment) return;
    view.dispatch({ effects: extCompartment.reconfigure(baseExtensions) });
  }, [baseExtensions]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const next = normalizeSingleLine(value ?? '');
    if (next === lastValueRef.current) return;
    isApplyingValueRef.current = true;
    try {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
      lastValueRef.current = next;
    } finally {
      queueMicrotask(() => {
        isApplyingValueRef.current = false;
      });
    }
  }, [value]);

  return <div ref={hostRef} className="regexExpressionEditor" />;
});
