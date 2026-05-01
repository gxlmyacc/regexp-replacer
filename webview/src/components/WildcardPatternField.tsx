import React, { memo } from 'react';
import { autoResizeTextarea } from '../utils';
import { Input } from './base';
import './WildcardPatternField.scss';

type WildcardTokenType =
  | 'plain'
  | 'wildcard-many'
  | 'wildcard-single'
  | 'wildcard-escape'
  | 'wildcard-quant-plus'
  | 'wildcard-quant-star'
  | 'wildcard-quant-qmark';

type WildcardToken = {
  type: WildcardTokenType;
  text: string;
};

export type WildcardPatternFieldMode = 'singleline' | 'multiline';

export type WildcardPatternFieldProps = {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  mode?: WildcardPatternFieldMode;
  status?: 'error';
  onChange: (nextValue: string) => void;
  onBlur?: () => void;
  onAfterChange?: () => void;
};

/**
 * 将 wildcard 表达式拆分为可高亮片段，规则与 wildcardToRegexSource 保持一致。
 *
 * @param pattern wildcard 表达式文本。
 * @returns 分词后的片段列表。
 */
function tokenizeWildcardPattern(pattern: string): WildcardToken[] {
  const out: WildcardToken[] = [];

  /**
   * 追加一个分词片段；若类型相同则合并，减少无效 span。
   *
   * @param type 片段类型。
   * @param text 片段文本。
   * @returns 无返回值。
   */
  function push(type: WildcardTokenType, text: string): void {
    if (!text) return;
    const prev = out[out.length - 1];
    if (prev && prev.type === type) {
      prev.text += text;
      return;
    }
    out.push({ type, text });
  }

  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '\\') {
      const next = pattern[i + 1];
      if (next === 'n' || next === 't' || next === 's' || next === 'S' || next === '*' || next === '?') {
        push('wildcard-escape', `\\${next}`);
        i += 1;
        continue;
      }
      push('plain', '\\');
      continue;
    }
    if (ch === '*') {
      push('wildcard-many', '*');
      continue;
    }
    if (ch === '?') {
      push('wildcard-single', '?');
      continue;
    }
    const prev = out[out.length - 1];
    const prevText = prev?.type === 'wildcard-escape' ? prev.text : '';
    const isQuantTargetEscape =
      prev && prev.type === 'wildcard-escape' && (prevText === '\\n' || prevText === '\\t' || prevText === '\\s' || prevText === '\\S');

    if (ch === '+' || ch === '*' || ch === '?') {
      if (isQuantTargetEscape) {
        if (ch === '+') push('wildcard-quant-plus', '+');
        else if (ch === '*') push('wildcard-quant-star', '*');
        else push('wildcard-quant-qmark', '?');
      } else {
        // 非 \n/\t/\s/\S 转义后的量词：仍按原语义高亮/转义显示
        if (ch === '+') push('plain', '+');
        else if (ch === '*') push('wildcard-many', '*');
        else push('wildcard-single', '?');
      }
      continue;
    }
    push('plain', ch);
  }
  return out;
}

/**
 * Wildcard 表达式输入框：提供通配符高亮，并支持单行/多行两种模式。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const WildcardPatternField = memo(function WildcardPatternField(props: WildcardPatternFieldProps): React.ReactElement {
  const { value, placeholder, disabled, mode = 'singleline', status, onChange, onBlur, onAfterChange } = props;
  const tokens = tokenizeWildcardPattern(value);
  const multiline = mode === 'multiline';
  const overlay = value ? (
    tokens.map((token, idx) => (
      <span key={`${idx}_${token.type}`} className={`wildcard-pattern-field__tok wildcard-pattern-field__tok--${token.type}`}>
        {token.text}
      </span>
    ))
  ) : (
    <span className="wildcard-pattern-field__placeholder">{placeholder ?? ''}</span>
  );

  return (
    <Input
      variant="mono"
      control={multiline ? 'textarea' : 'input'}
      mode={multiline ? 'multiline' : 'singleline'}
      status={status}
      disabled={disabled}
      className="wildcard-pattern-field"
      controlClassName={`wildcard-pattern-field__textarea ${multiline ? 'wildcard-pattern-field__textarea--multiline' : 'wildcard-pattern-field__textarea--singleline'}`}
      overlay={overlay}
      rows={multiline ? 1 : undefined}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onChange(e.target.value);
        if (multiline) autoResizeTextarea(e.currentTarget as HTMLTextAreaElement);
        onAfterChange?.();
      }}
      onInput={
        multiline
          ? (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
              if (e.currentTarget instanceof HTMLTextAreaElement) autoResizeTextarea(e.currentTarget);
            }
          : undefined
      }
      onBlur={() => onBlur?.()}
    />
  );
});

