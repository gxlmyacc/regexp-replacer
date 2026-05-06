import React, { memo, useMemo, useRef } from 'react';
import './ReplaceResultBox.scss';

export type ReplaceResultPart = { text: string; replaced: boolean };

export type ReplaceResultBoxProps = {
  className?: string;
  parts: ReplaceResultPart[];
  fallbackText: string;
  emptyText: string;
  replacedCount: number;
  maxChars: number;
  onTruncated?: () => void;
  /** 是否高亮“替换生成”的片段；关闭时展示纯文本。 */
  highlightReplaced?: boolean;
};

export type ReplaceLineRow = { lineNumber: number; segments: ReplaceResultPart[] };

/**
 * 按全局偏移从片段列表中切出某一行的子片段（用于跨行仍保留 replaced 标记）。
 *
 * @param parts 片段列表。
 * @param lineStart 该行在全文中的起始偏移（含）。
 * @param lineEnd 该行在全文中的结束偏移（不含）。
 * @returns 仅覆盖该行范围的片段列表。
 */
export function slicePartsForLine(parts: ReplaceResultPart[], lineStart: number, lineEnd: number): ReplaceResultPart[] {
  let pos = 0;
  const out: ReplaceResultPart[] = [];
  for (const p of parts) {
    const pEnd = pos + p.text.length;
    const s = Math.max(lineStart, pos);
    const e = Math.min(lineEnd, pEnd);
    if (e > s) {
      out.push({ text: p.text.slice(s - pos, e - pos), replaced: p.replaced });
    }
    pos = pEnd;
    if (pos > lineEnd) break;
  }
  return out;
}

/**
 * 将片段按换行切成多行，供行号列与正文对齐展示。
 *
 * @param parts 截断后的片段列表（非空）。
 * @returns 每行的行号与该行内片段。
 */
export function buildReplaceLineRows(parts: ReplaceResultPart[]): ReplaceLineRow[] {
  const full = parts.map((p) => p.text).join('');
  const lines = full.split('\n');
  let offset = 0;
  return lines.map((lineText, i) => {
    const lineStart = offset;
    const lineEnd = lineStart + lineText.length;
    offset = lineEnd + 1;
    return {
      lineNumber: i + 1,
      segments: slicePartsForLine(parts, lineStart, lineEnd),
    };
  });
}

/**
 * 渲染一行内的替换片段（高亮或纯文本）。
 *
 * @param segments 行内片段。
 * @param highlight 是否高亮 replaced。
 * @returns React 节点。
 */
function replaceLineSegmentsContent(segments: ReplaceResultPart[], highlight: boolean): React.ReactNode {
  if (highlight) {
    return (
      <span className="replacePreviewRich">
        {segments.map((p, idx) => (
          <span key={idx} className={p.replaced ? 'replacePreviewHit' : undefined}>
            {p.text}
          </span>
        ))}
      </span>
    );
  }
  return <span className="replacePreviewRich">{segments.map((p) => p.text).join('')}</span>;
}

/**
 * Replace 页签结果区：可聚焦、支持 Ctrl+A 选中结果；带行号列并保留替换片段高亮。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const ReplaceResultBox = memo(function ReplaceResultBox(props: ReplaceResultBoxProps): React.ReactElement {
  const { className, parts, fallbackText, emptyText, replacedCount, maxChars, onTruncated, highlightReplaced = false } = props;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const truncatedRef = useRef(false);

  const view = useMemo(() => {
    const limit = Math.max(0, maxChars);
    let outLen = 0;
    let truncated = false;
    const out: ReplaceResultPart[] = [];

    const src = parts.length ? parts : [{ text: fallbackText, replaced: false }];
    for (const p of src) {
      if (!p.text) continue;
      if (outLen >= limit) {
        truncated = true;
        break;
      }
      const remain = limit - outLen;
      const slice = p.text.length <= remain ? p.text : p.text.slice(0, remain);
      out.push({ text: slice, replaced: p.replaced });
      outLen += slice.length;
      if (p.text.length > remain) {
        truncated = true;
        break;
      }
    }
    return { out, truncated };
  }, [parts, fallbackText, maxChars]);

  const lineRows = useMemo(() => (view.out.length ? buildReplaceLineRows(view.out) : []), [view.out]);
  const gutterMinCh = lineRows.length ? Math.max(2, String(lineRows[lineRows.length - 1]!.lineNumber).length) : 2;

  if (view.truncated && !truncatedRef.current) {
    truncatedRef.current = true;
    onTruncated?.();
  }

  const rootClass = [
    className ?? '',
    'replaceResultBox',
    lineRows.length ? 'replaceResultBox--lined' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={hostRef}
      className={rootClass}
      tabIndex={0}
      role="textbox"
      aria-readonly="true"
      onKeyDown={(e) => {
        const isA = e.key.toLowerCase() === 'a';
        const isSelectAll = isA && (e.ctrlKey || e.metaKey);
        if (!isSelectAll) return;
        e.preventDefault();
        const el = hostRef.current;
        if (!el) return;
        const sel = window.getSelection();
        if (!sel) return;
        const range = document.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
      }}
      onMouseDown={() => {
        hostRef.current?.focus();
      }}
    >
      {lineRows.length ? (
        <div className="replaceResultBox__lines">
          {lineRows.map((row) => (
            <div key={row.lineNumber} className="replaceResultBox__row">
              <span
                className="replaceResultBox__gutter"
                aria-hidden="true"
                style={{ minWidth: `${gutterMinCh}ch` }}
              >
                {row.lineNumber}
              </span>
              <div className="replaceResultBox__lineMain">{replaceLineSegmentsContent(row.segments, highlightReplaced)}</div>
            </div>
          ))}
        </div>
      ) : replacedCount > 0 ? (
        <span style={{ opacity: 0.7 }}>{emptyText}</span>
      ) : (
        ''
      )}
    </div>
  );
});
