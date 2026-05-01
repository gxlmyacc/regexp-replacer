import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AutoEllipsis } from './AutoEllipsis';
import { Button } from './Button';
import { Icon } from './Icon';
import { Popover } from './Popover';
import { Tooltip } from './Tooltip';
import './DropdownMenu.scss';

export type DropdownOption = {
  id: string;
  label: string;
  disabled?: boolean;
  checked?: boolean;
  title?: string;
};

export type DropdownMenuMode = 'single' | 'multi';

export type DropdownMenuPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

export type DropdownMenuIndicator = 'auto' | 'none' | 'radio' | 'checkbox';

export type DropdownMenuProps = {
  buttonLabel: string;
  /** 按钮标签后缀（如帮助图标/提示）。 */
  buttonLabelSuffix?: React.ReactNode;
  buttonTitle?: string;
  buttonActive?: boolean;
  menuTitle?: string;
  mode: DropdownMenuMode;
  placement?: DropdownMenuPlacement;
  offset?: number;
  autoFlip?: boolean;
  indicator?: DropdownMenuIndicator;
  minMenuWidth?: number;
  name?: string;
  options: DropdownOption[];
  onToggle: (id: string) => void;
  closeOnToggle?: boolean;
  disabled?: boolean;
};

/**
 * 统一样式的下拉菜单组件（按钮 + Popover 菜单）。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const DropdownMenu = memo(function DropdownMenu(props: DropdownMenuProps): React.ReactElement {
  const {
    buttonLabel,
    buttonLabelSuffix,
    buttonTitle,
    buttonActive,
    menuTitle,
    mode,
    placement = 'bottom-start',
    offset = 6,
    autoFlip = true,
    indicator = 'auto',
    minMenuWidth = 160,
    name,
    options,
    onToggle,
    closeOnToggle = false,
    disabled = false,
  } = props;

  const [open, setOpen] = useState(false);
  const [menuMinWidth, setMenuMinWidth] = useState<number>(minMenuWidth);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const groupName = useMemo(() => name ?? `rr-dd-${Math.random().toString(16).slice(2)}`, [name]);
  const inputType = useMemo(() => {
    if (indicator === 'none') return null;
    if (indicator === 'radio') return 'radio';
    if (indicator === 'checkbox') return 'checkbox';
    return mode === 'single' ? 'radio' : 'checkbox';
  }, [indicator, mode]);

  useEffect(() => {
    const btn = btnRef.current;
    if (!open || !btn) return;
    setMenuMinWidth(Math.max(minMenuWidth, Math.floor(btn.getBoundingClientRect().width)));
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      const targetEl = target instanceof Element ? target : target.parentElement;
      const inPopover = targetEl?.closest('.rrDropdownMenu') !== null;
      const inBtn = btnRef.current?.contains(target) ?? false;
      if (inPopover || inBtn) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onDown, true);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
    };
  }, [open, minMenuWidth]);

  return (
    <div className="rrDropdownMenuHost">
      {buttonTitle ? (
        <Tooltip content={buttonTitle}>
          <Button
            className={`btnHasCaret ${buttonActive ? 'btnDropdownActive' : ''}`}
            htmlType="button"
            ref={btnRef}
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="btnLabelSingleLine">{buttonLabel}</span>
            {buttonLabelSuffix ? <span className="rrDropdownMenuBtnSuffix">{buttonLabelSuffix}</span> : null}
            <span className="btnCaret">{open ? <Icon type="caretUp" /> : <Icon type="caretDown" />}</span>
          </Button>
        </Tooltip>
      ) : (
        <Button
          className={`btnHasCaret ${buttonActive ? 'btnDropdownActive' : ''}`}
          htmlType="button"
          ref={btnRef}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="btnLabelSingleLine">{buttonLabel}</span>
          {buttonLabelSuffix ? <span className="rrDropdownMenuBtnSuffix">{buttonLabelSuffix}</span> : null}
          <span className="btnCaret">{open ? <Icon type="caretUp" /> : <Icon type="caretDown" />}</span>
        </Button>
      )}

      <Popover
        open={open}
        referenceEl={btnRef.current}
        placement={placement}
        offset={offset}
        autoFlip={autoFlip}
        className="rrDropdownMenu"
        style={{ minWidth: menuMinWidth }}
        arrow={true}
        arrowClassName="rrDropdownMenu__arrow"
      >
        {menuTitle ? <div className="rrDropdownMenu__title">{menuTitle}</div> : null}
        <div className="rrDropdownMenu__body">
          {options.map((o) => (
            <div
              key={o.id}
              className={`rrDropdownMenu__item ${o.disabled ? 'rrDropdownMenu__item--disabled' : ''}`}
              onClick={() => {
                if (o.disabled) return;
                onToggle(o.id);
                if (closeOnToggle) setOpen(false);
              }}
            >
              {inputType ? (
                <input
                  type={inputType}
                  name={inputType === 'radio' ? groupName : undefined}
                  readOnly
                  checked={Boolean(o.checked)}
                />
              ) : null}
              <AutoEllipsis className="rrDropdownMenu__itemLabel" content={o.title ?? o.label}>
                {o.label}
              </AutoEllipsis>
            </div>
          ))}
        </div>
      </Popover>
    </div>
  );
});

