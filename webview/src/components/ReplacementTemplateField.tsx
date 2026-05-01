import React, { memo } from 'react';
import { Input } from './base';
import type { InputVariant } from './base';
import './ReplacementTemplateField.scss';

type ReplacementTemplateTokenType = 'plain' | 'escape' | 'replacement-index' | 'replacement-special';

type ReplacementTemplateToken = {
  type: ReplacementTemplateTokenType;
  text: string;
};

export type ReplacementTemplateFieldProps = {
  value: string;
  disabled?: boolean;
  placeholder?: string;
  highlightEnabled?: boolean;
  /**
   * 捕获组色阶映射：index 0 对应 $1，值域 1..6（循环）。
   * 若不传，则按 $n 的 n 自行循环配色。
   */
  captureGroupLevels?: number[];
  /**
   * 输入框样式变体：默认为 mono（与规则编辑器一致）。
   */
  variant?: InputVariant;
  onChange: (value: string) => void;
};

/**
 * 将替换模板拆分为可高亮的片段（普通文本、转义序列、分组引用、其他替换占位符）。
 *
 * @param template 替换模板文本。
 * @returns 分词后的片段列表。
 */
function tokenizeReplacementTemplate(template: string): ReplacementTemplateToken[] {
  const out: ReplacementTemplateToken[] = [];

  /**
   * 追加一个分词片段；若类型相同则与前一片段合并。
   *
   * @param type 片段类型。
   * @param text 片段文本。
   * @returns 无返回值。
   */
  function push(type: ReplacementTemplateTokenType, text: string): void {
    if (!text) return;
    const prev = out[out.length - 1];
    // 仅合并 plain，避免把 $1$2$3 合并成一个 span（否则无法按 $n 分别着色）。
    if (type === 'plain' && prev && prev.type === type) {
      prev.text += text;
      return;
    }
    out.push({ type, text });
  }

  for (let i = 0; i < template.length; i += 1) {
    const ch = template[i];

    if (ch === '\\') {
      const next = template[i + 1];
      if (next === 'n' || next === 'r' || next === 't' || next === '\\') {
        push('escape', `\\${next}`);
        i += 1;
        continue;
      }
      push('plain', ch);
      continue;
    }

    if (ch === '$') {
      const next = template[i + 1];
      if (next === '$' || next === '&' || next === '`' || next === "'") {
        push('replacement-special', `$${next}`);
        i += 1;
        continue;
      }
      if (next && /\d/.test(next)) {
        const next2 = template[i + 2];
        if (next2 && /\d/.test(next2)) {
          push('replacement-index', `$${next}${next2}`);
          i += 2;
          continue;
        }
        push('replacement-index', `$${next}`);
        i += 1;
        continue;
      }
      if (next === '<') {
        const end = template.indexOf('>', i + 2);
        if (end > i + 2) {
          push('replacement-special', template.slice(i, end + 1));
          i = end;
          continue;
        }
      }
    }

    push('plain', ch);
  }
  return out;
}

/**
 * 从 replacement-index token（如 $1、$12）解析出分组索引。
 *
 * @param tokenText token 文本。
 * @returns 分组索引（从 1 开始）；无法解析则返回 undefined。
 */
function parseReplacementIndex(tokenText: string): number | undefined {
  if (!tokenText || tokenText[0] !== '$') return undefined;
  const raw = tokenText.slice(1);
  if (!raw || !/^\d{1,2}$/.test(raw)) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/**
 * 将分组索引映射到 1..6 的循环色阶。
 *
 * @param groupIndex 分组索引（从 1 开始）。
 * @returns 色阶编号（1..6）。
 */
function levelFromGroupIndex(groupIndex: number): number {
  return ((Math.max(groupIndex, 1) - 1) % 6) + 1;
}

/**
 * 替换模板输入框：支持普通输入，并可在 regex 引擎下高亮模板特殊字符。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const ReplacementTemplateField = memo(function ReplacementTemplateField(
  props: ReplacementTemplateFieldProps,
): React.ReactElement {
  const { value, disabled, placeholder, highlightEnabled = false, captureGroupLevels, variant = 'mono', onChange } = props;
  const tokens = tokenizeReplacementTemplate(value);
  const overlay = highlightEnabled ? (
    <>
      {value ? (
        tokens.map((token, idx) => {
          let extraCls = '';
          if (token.type === 'replacement-index') {
            const n = parseReplacementIndex(token.text);
            const level =
              n && captureGroupLevels && captureGroupLevels[n - 1] ? captureGroupLevels[n - 1] : n ? levelFromGroupIndex(n) : undefined;
            if (level) extraCls = ` replacement-template-field__tok--replacement-index-l${level}`;
          }
          return (
            <span
              key={`${idx}_${token.type}`}
              className={`replacement-template-field__tok replacement-template-field__tok--${token.type}${extraCls}`.trim()}
            >
              {token.text}
            </span>
          );
        })
      ) : (
        <span className="replacement-template-field__placeholder">{placeholder ?? ''}</span>
      )}
    </>
  ) : undefined;

  return (
    <Input
      variant={variant}
      control="input"
      disabled={disabled}
      className="replacement-template-field"
      controlClassName={`replacement-template-field__textarea ${highlightEnabled ? 'replacement-template-field__textarea--highlight' : ''}`}
      overlay={overlay}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
    />
  );
});

