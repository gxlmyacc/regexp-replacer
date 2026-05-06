import React, { memo, useEffect, useMemo, useRef } from 'react';
import { EditorView, hoverTooltip, keymap, placeholder, tooltips, type Tooltip, type ViewUpdate } from '@codemirror/view';
import { Compartment, EditorState, RangeSetBuilder } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { Decoration, ViewPlugin } from '@codemirror/view';
import { tokenizeRegexPattern, type RegexTokenType } from '../utils';
import { collectBracketDiagnostics, collectBracketPairs } from '../utils/regexBracketScan';
import type { LanguageCode } from '../i18n';
import './RegexExpressionEditor.scss';

export type RegexExpressionEditorProps = {
  value: string;
  placeholder?: string;
  uiLanguage: LanguageCode;
  onChange: (value: string) => void;
  /** 输入后触发一次重算（上游可做 debounce，此处按需每次触发）。 */
  onAfterChange: () => void;
  /** 编辑器失焦时触发（可选；用于映射表等场景的校验提示）。 */
  onBlur?: () => void;
};

/**
 * 正则表达式编辑器（CodeMirror 版）：在输入框内对正则 token 进行高亮显示。
 *
 * @param props 组件属性；其中 `onBlur` 可选，在编辑器失焦时触发（例如映射表行内校验）。
 * @returns React 元素。
 */
export const RegexExpressionEditor = memo(function RegexExpressionEditor(props: RegexExpressionEditorProps): React.ReactElement {
  const { value, placeholder: ph, uiLanguage, onChange, onAfterChange, onBlur } = props;
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
          // boxShadow: '0 0 0 1px rgba(0, 127, 212, 0.2)',
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
      // 若用户输入了换行，这里会被压平；同时把压平后的值写回到父组件（受控源）。
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

    // 正则 token 高亮：用 Decoration.mark 给不同 token 区段加 class。
    const tokenHighlight = ViewPlugin.fromClass(
      class {
        decorations;
        constructor(view: EditorView) {
          this.decorations = buildRegexTokenDecorations(view);
        }
        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged || update.selectionSet) {
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
      const activePair = findNearestActiveBracketPair(text, view.state.selection.main.head);
      const activeBracketOffsets = activePair ? new Set<number>([activePair.openOffset, activePair.closeOffset]) : new Set<number>();
      const activeInnerRange = activePair ? { from: activePair.openOffset, to: activePair.closeOffset + 1 } : undefined;
      const pendingMarks: { from: number; to: number; mark: Decoration }[] = [];

      /**
       * 暂存 decoration，最后统一排序后写入，避免 RangeSetBuilder 顺序报错。
       *
       * @param from 起始偏移（含）。
       * @param to 结束偏移（不含）。
       * @param className 样式类名。
       * @returns 无返回值。
       */
      function pushMark(from: number, to: number, className: string): void {
        if (to <= from) return;
        pendingMarks.push({ from, to, mark: Decoration.mark({ class: className }) });
      }

      if (activeInnerRange) {
        const level = levelFromDepth(activePair?.depth ?? 1);
        pushMark(
          activeInnerRange.from,
          activeInnerRange.to,
          `rrRegexTok rrRegexTok--pair-active-range rrRegexTok--pair-active-range-l${level}`,
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
            pushMark(charFrom, charTo, classForBracketDepth(meta.kind, meta.depth));
            if (activeBracketOffsets.has(charFrom)) pushMark(charFrom, charTo, 'rrRegexTok rrRegexTok--pair-active');
          }
          continue;
        }
        if (tok.type === 'class' || tok.type === 'quant') {
          // class/quant 仍保留 token 着色；活跃范围高亮由统一 range decoration 负责。
          pushMark(from, to, classForToken(tok.type));
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
        pushMark(from, to, classForToken(tok.type));
      }
      const diagnostics = collectRegexDiagnostics(text);
      for (const d of diagnostics) {
        pushMark(d.from, d.to, 'rrRegexTok rrRegexTok--error');
      }
      pendingMarks
        .sort((a, b) => (a.from === b.from ? a.to - b.to : a.from - b.from))
        .forEach((item) => builder.add(item.from, item.to, item.mark));
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
     * 根据光标偏移查找“最近层级”的括号对（支持 ()、[]、{}）。
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
        // 仅当光标位于括号内部（开括号之后、闭括号之前）时，才视为处于该层级。
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
     * 收集正则表达式诊断信息：括号配对问题与编译语法问题。
     *
     * @param text 正则文本。
     * @returns 诊断列表（from/to/message）。
     */
    function collectRegexDiagnostics(text: string): { from: number; to: number; message: string }[] {
      const out: { from: number; to: number; message: string }[] = [];
      const bracketDiagnostics = collectBracketDiagnostics(text);
      out.push(...bracketDiagnostics);
      const syntaxMessage = collectRegexSyntaxError(text);
      // 若已定位到具体括号错误，优先展示“精确定位”的下划线，不再叠加整段错误线。
      if (syntaxMessage && text.length > 0 && bracketDiagnostics.length === 0) {
        out.push({ from: 0, to: text.length, message: syntaxMessage });
      }
      return out;
    }

    /**
     * 检查正则编译错误，并返回可读错误信息。
     *
     * @param text 正则文本。
     * @returns 错误消息；若可编译则返回 undefined。
     */
    function collectRegexSyntaxError(text: string): string | undefined {
      if (!text) return undefined;
      try {
        // 仅做语法校验，不执行匹配。
        new RegExp(text);
        return undefined;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (!message) return uiLanguage === 'zh-CN' ? '正则语法错误' : 'Regex syntax error';
        const translated = translateRegexErrorMessage(message, uiLanguage);
        return uiLanguage === 'zh-CN' ? `正则语法错误：${translated}` : `Regex syntax error: ${translated}`;
      }
    }

    /**
     * 将 RegExp 原始错误消息转换为更友好的中英文短句。
     *
     * @param message 原始错误消息。
     * @param language 当前 UI 语言。
     * @returns 翻译/归一化后的短句。
     */
    function translateRegexErrorMessage(message: string, language: LanguageCode): string {
      if (language !== 'zh-CN') return message;
      const m = message.toLowerCase();
      if (m.includes('unterminated character class')) return '字符类未闭合（缺少 ]）';
      if (m.includes('unterminated group')) return '分组未闭合（缺少 )）';
      if (m.includes('nothing to repeat')) return '量词前缺少可重复目标';
      if (m.includes('invalid regular expression flags')) return '正则标志无效';
      if (m.includes('invalid group')) return '分组语法无效';
      if (m.includes('invalid escape')) return '转义序列无效';
      if (m.includes('unmatched')) return '存在未匹配的括号或分隔符';
      return message;
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
     * 基于诊断信息提供悬浮提示：当鼠标悬停到错误下划线范围时，显示错误消息 Tooltip。
     *
     * @returns CodeMirror 扩展（hoverTooltip）。
     */
    function createDiagnosticsHoverTooltip() {
      return hoverTooltip((view, pos): Tooltip | null => {
        const text = view.state.doc.toString();
        const diagnostics = collectRegexDiagnostics(text);
        const hit = diagnostics.find((d) => d.from <= pos && pos <= d.to);
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
      /* Tooltip 根挂在 body，避免落在 .cm-editor/.cm-scroller 内被 overflow 裁切 */
      tooltips({ parent: document.body }),
      history(),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      ph ? placeholder(ph) : [],
      // 允许自动换行（与原 textarea 体验更接近）
      EditorView.lineWrapping,
      vscodeTheme,
      tokenHighlight,
      createDiagnosticsHoverTooltip(),
      updateListener,
      blurHandlers,
    ];
  }, [onAfterChange, onBlur, onChange, ph, uiLanguage]);

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

