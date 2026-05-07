import React, { memo } from 'react';
import { autoResizeTextarea } from '../utils';
import { RegexFlagChips, type RegexFlagChipsLabels } from './RegexFlagChips';
import { RegexExpressionEditor } from './RegexExpressionEditor';
import { WildcardPatternField } from './WildcardPatternField';
import './RuleExpressionField.scss';
import type { ReplaceEngine } from '../../../src/types';
import type { LanguageCode } from '../i18n';

export type RuleExpressionFieldProps = {
  engine: ReplaceEngine;
  value: string;
  placeholder: string;
  onChange: (next: string) => void;
  /** 正则时传入解析结果中的 flags 字符串。 */
  regexEnabledFlags: string | undefined;
  onToggleFlag: (flag: string) => void;
  flagLabels: RegexFlagChipsLabels;
  uiLanguage: LanguageCode;
  /** 重算匹配（如 debounce 上游已处理，此处每次输入触发）。 */
  onAfterChange: () => void;
};

/**
 * 规则 find 编辑区：多行自增高文本域；regex 引擎时附带 RegexFlagChips。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const RuleExpressionField = memo(function RuleExpressionField(props: RuleExpressionFieldProps): React.ReactElement {
  const { engine, value, placeholder, onChange, regexEnabledFlags, onToggleFlag, flagLabels, uiLanguage, onAfterChange } = props;
  const showFlags = engine === 'regex' && regexEnabledFlags !== undefined;

  return (
    <>
      {engine === 'regex' ? (
        <RegexExpressionEditor
          value={value}
          placeholder={placeholder}
          uiLanguage={uiLanguage}
          regexFlags={regexEnabledFlags ?? ''}
          onChange={(v) => onChange(v)}
          onAfterChange={onAfterChange}
        />
      ) : engine === 'wildcard' ? (
        <WildcardPatternField
          mode="multiline"
          value={value}
          placeholder={placeholder}
          onChange={(v) => onChange(v)}
          onAfterChange={onAfterChange}
        />
      ) : (
        <textarea
          className="rule-expression-field__textarea"
          rows={1}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v);
            autoResizeTextarea(e.currentTarget);
            onAfterChange();
          }}
          onInput={(e) => autoResizeTextarea(e.currentTarget)}
        />
      )}
      {showFlags ? (
        <RegexFlagChips enabledFlags={regexEnabledFlags} onToggle={onToggleFlag} labels={flagLabels} />
      ) : null}
    </>
  );
});
