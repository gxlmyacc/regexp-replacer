import React, { memo, useEffect, useRef, useState } from 'react';
import { AutoEllipsis, Input, Tooltip } from './base';
import './RuleTitleEditor.scss';

export type RuleTitleEditorProps = {
  value?: string;
  fallbackLabel: string;
  placeholder: string;
  /** 当标题为空、显示默认规则名时的提示气泡文案。 */
  defaultTitleTip?: string;
  onCommit: (nextTitle: string | undefined) => void;
};

/**
 * 规则标题编辑器：默认只读展示，点击进入编辑；失焦后提交并退出编辑。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const RuleTitleEditor = memo(function RuleTitleEditor(props: RuleTitleEditorProps): React.ReactElement {
  const { value, fallbackLabel, placeholder, defaultTitleTip, onCommit } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) return;
    setDraft(value ?? '');
  }, [editing, value]);

  function commit(): void {
    const next = draft.trim();
    onCommit(next ? next : undefined);
    setEditing(false);
  }

  const isDefaultTitle = !(value ?? '').trim();

  return editing ? (
    <Input
      ref={inputRef}
      variant="ruleTitle"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.currentTarget as HTMLInputElement).blur();
        }
        if (e.key === 'Escape') {
          setDraft(value ?? '');
          setEditing(false);
        }
      }}
      autoFocus
    />
  ) : (
    <Tooltip content={isDefaultTitle ? defaultTitleTip : ''}>
      <button
        type="button"
        className="ruleTitleTag"
        onClick={() => {
          setDraft(value ?? '');
          setEditing(true);
          queueMicrotask(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
          });
        }}
      >
        <AutoEllipsis className="ruleTitleText" content={value ? value : fallbackLabel} block>
          {value ? value : fallbackLabel}
        </AutoEllipsis>
      </button>
    </Tooltip>
  );
});

