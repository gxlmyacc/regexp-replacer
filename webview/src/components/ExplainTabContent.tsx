import React, { memo } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import type { ReplaceEngine } from '../../../src/types';

export type ExplainTabContentProps = {
  className?: string;
  engine?: ReplaceEngine;
};

/**
 * 工具区「说明」页：引擎与替换模板占位符说明（文案由 i18n 注入）。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const ExplainTabContent = memo(function ExplainTabContent(props: ExplainTabContentProps): React.ReactElement {
  const { className, engine } = props;
  const { t: x } = useI18n();
  const showRegex = engine === undefined || engine === 'regex';
  const showText = engine === undefined || engine === 'text';
  const showWildcard = engine === undefined || engine === 'wildcard';
  return (
    <div className={className}>
      <div style={{ opacity: 0.85, marginBottom: 8 }}>{x.explain}</div>
      <div style={{ opacity: 0.85, marginBottom: 6 }}>{x.explainEnginesTitle}</div>
      {showRegex ? <div>{x.explainEngineRegex}</div> : null}
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
