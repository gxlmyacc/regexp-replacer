import React, { memo, useMemo } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import type { ReplaceEngine } from '../../../src/types';
import { buildRegexExplainOutline } from '../utils/regexHighlight';

export type ExplainTabContentProps = {
  className?: string;
  engine?: ReplaceEngine;
  /** 当前正则 pattern（仅 `regex` 引擎时传入）。 */
  regexPattern?: string;
  /** 当前正则 flags（仅 `regex` 引擎时传入）。 */
  regexFlags?: string;
};

/**
 * 工具区「说明」页：引擎与替换模板占位符说明（文案由 i18n 注入）。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const ExplainTabContent = memo(function ExplainTabContent(props: ExplainTabContentProps): React.ReactElement {
  const { className, engine, regexPattern, regexFlags } = props;
  const { t: x } = useI18n();
  const showRegex = engine === undefined || engine === 'regex';
  const showText = engine === undefined || engine === 'text';
  const showWildcard = engine === undefined || engine === 'wildcard';

  const regexOutline = useMemo(() => {
    if (regexPattern === undefined) return null;
    return buildRegexExplainOutline(regexPattern, regexFlags ?? '', x);
  }, [regexPattern, regexFlags, x]);

  return (
    <div className={className}>
      <div style={{ opacity: 0.85, marginBottom: 8 }}>{x.explain}</div>
      <div style={{ opacity: 0.85, marginBottom: 6 }}>{x.explainEnginesTitle}</div>
      {showRegex ? <div>{x.explainEngineRegex}</div> : null}
      {showRegex && regexOutline ? (
        <div style={{ marginTop: 10, opacity: 0.9 }}>
          <div style={{ marginBottom: 6, opacity: 0.85 }}>{x.explainRegexStructureTitle}</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {regexOutline.segments.map((s, i) => (
              <li key={`${i}-${s.text.slice(0, 24)}`} style={{ marginBottom: 4 }}>
                {s.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {showText ? <div>{x.explainEngineText}</div> : null}
      {showWildcard ? <div>{x.explainEngineWildcard}</div> : null}
      <div style={{ marginTop: 10, opacity: 0.85, marginBottom: 6 }}>{x.explainReplacementTitle}</div>
      <div>{x.explainDollar1}</div>
      <div>{x.explainDollarAmp}</div>
      <div>{x.explainDollarBacktick}</div>
      <div>{x.explainDollarQuote}</div>
      <div>{x.explainDollarDollar}</div>
    </div>
  );
});
