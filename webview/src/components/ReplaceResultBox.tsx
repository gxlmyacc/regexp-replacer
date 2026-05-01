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

/**
 * Replace 页签结果区：可聚焦、支持 Ctrl+A 仅选中结果，并保留替换片段高亮。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const ReplaceResultBox = memo(function ReplaceResultBox(props: ReplaceResultBoxProps): React.ReactElement {
  const { className, parts, fallbackText, emptyText, replacedCount, maxChars, onTruncated, highlightReplaced = true } = props;
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

  if (view.truncated && !truncatedRef.current) {
    truncatedRef.current = true;
    onTruncated?.();
  }

  return (
    <div
      ref={hostRef}
      className={`${className ?? ''} replaceResultBox`.trim()}
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
      {view.out.length ? (
        highlightReplaced ? (
          <span className="replacePreviewRich">
            {view.out.map((p, idx) => (
              <span key={idx} className={p.replaced ? 'replacePreviewHit' : undefined}>
                {p.text}
              </span>
            ))}
          </span>
        ) : (
          <span>{view.out.map((p) => p.text).join('')}</span>
        )
      ) : replacedCount > 0 ? (
        <span style={{ opacity: 0.7 }}>{emptyText}</span>
      ) : (
        ''
      )}
    </div>
  );
});

