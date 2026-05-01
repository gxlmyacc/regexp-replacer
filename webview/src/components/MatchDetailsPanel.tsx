import React, { memo } from 'react';
import type { MatchItem } from '../features/tester/matchHighlighter';
import type { ReplaceEngine } from '../../../src/types';
import { useI18n } from '../i18n/I18nProvider';

export type MatchDetailsPanelProps = {
  engine: ReplaceEngine | undefined;
  flagsDisplay: string;
  current: MatchItem | undefined;
  matchError?: string;
  className?: string;
};

/**
 * 工具区「详情」页：展示当前规则 engine/flags 与当前匹配项、分组内容。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const MatchDetailsPanel = memo(function MatchDetailsPanel(props: MatchDetailsPanelProps): React.ReactElement {
  const { engine, flagsDisplay, current, matchError, className } = props;
  const { t, lang } = useI18n();
  const engineStr = engine ?? '-';
  const line = t.detailsEngineFlags.replace('{engine}', engineStr).replace('{flags}', flagsDisplay);
  const groupLabel = (i: number) => t.detailsGroupLabel.replace('{n}', String(i + 1));
  const errorTitle = lang === 'zh-CN' ? '错误' : 'ERROR';
  const errorLabel = lang === 'zh-CN' ? '表达式校验失败：' : 'Expression validation failed:';
  const indexLine = current
    ? t.detailsMatchIndexLine
        .replace('{index}', String(current.index))
        .replace('{start}', String(current.startOffset))
        .replace('{end}', String(current.endOffset))
    : '—';

  return (
    <div className={className}>
      <div style={{ opacity: 0.85, marginBottom: 6 }}>{line}</div>
      {matchError ? (
        <div
          style={{
            border: '1px solid var(--vscode-inputValidation-errorBorder, #f14c4c)',
            background: 'color-mix(in srgb, var(--vscode-inputValidation-errorBorder, #f14c4c) 12%, transparent)',
            borderRadius: 4,
            padding: '8px 10px',
            marginBottom: 8,
          }}
        >
          <span style={{ fontWeight: 700, color: 'var(--vscode-inputValidation-errorBorder, #f14c4c)' }}>{errorTitle}: </span>
          <span style={{ opacity: 0.9 }}>{errorLabel}</span>
          <span>{matchError}</span>
        </div>
      ) : null}

      <div style={{ border: '1px solid rgba(127,127,127,0.25)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ padding: 8, background: 'rgba(127,127,127,0.12)', display: 'flex', gap: 8 }}>
          <div style={{ width: 80, opacity: 0.75 }}>{t.detailsColMatch}</div>
          <div style={{ flex: 1, minWidth: 0 }}>{indexLine}</div>
        </div>
        <div style={{ padding: 8, display: 'flex', gap: 8 }}>
          <div style={{ width: 80, opacity: 0.75 }}>{t.detailsColText}</div>
          <div style={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap' }}>{current ? current.matchText : ''}</div>
        </div>
        <div style={{ padding: 8, background: 'rgba(127,127,127,0.08)', opacity: 0.85 }}>{t.detailsColGroups}</div>
        {current && current.groups.length > 0 ? (
          current.groups.map((g, i) => (
            <div
              key={i}
              style={{
                padding: 8,
                display: 'flex',
                gap: 8,
                borderTop: '1px solid rgba(127,127,127,0.12)',
              }}
            >
              <div style={{ width: 80, opacity: 0.75 }}>{groupLabel(i)}</div>
              <div style={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap' }}>{g}</div>
            </div>
          ))
        ) : (
          <div style={{ padding: 8, borderTop: '1px solid rgba(127,127,127,0.12)', opacity: 0.75 }}>{t.detailsNoGroups}</div>
        )}
      </div>
    </div>
  );
});
