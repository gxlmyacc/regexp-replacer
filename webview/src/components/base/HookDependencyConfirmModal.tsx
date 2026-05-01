import React, { forwardRef, useLayoutEffect, useMemo, useState } from 'react';
import useModalRef, { type ModalRef } from 'use-modal-ref';
import { Modal } from './Modal';
import { Button } from './Button';
import type { HookReferrerBlock, HookReferrerEntry, HookReferrerRow } from '../../features/hooks/hookReferrers';
import './HookDependencyConfirmModal.scss';

/** 弹窗入参：文案、引用列表、可选「从其他命令移除」主开关及逐条引用行。 */
export type HookDependencyConfirmModalData = {
  /** 标题。 */
  title: React.ReactNode;
  /** 正文引导说明。 */
  intro: React.ReactNode;
  /** 按命令分组后的引用列表（无结构化行时用于展示，如删除命令流程）。 */
  referrerBlocks: HookReferrerBlock[];
  /**
   * 可逐条勾选的引用行（禁用规则流程传入）；优先于 referrerBlocks 展示列表区。
   * 与主开关配合：主开关勾选时，仅对已勾选的行从对应规则前/后置列表移除引用。
   */
  referrerRows?: HookReferrerRow[];
  /** 每条引用旁复选框的无障碍说明。 */
  referrerRowCheckboxAria?: string;
  /** 取消按钮文案。 */
  cancelText: string;
  /** 确认按钮文案。 */
  okText: string;
  /** 确认按钮是否为危险操作样式。 */
  danger?: boolean;
  /** 是否展示「从其他命令的前置/后置中移除」主复选框。 */
  showRemoveFromOthersCheckbox: boolean;
  /** 主复选框标签文案。 */
  removeFromOthersLabel: string;
};

/** 弹窗返回值：是否确认、主开关，以及待移除引用的结构化条目（未勾选主开关时为空数组）。 */
export type HookDependencyConfirmModalResult = {
  /** 用户是否点击确认。 */
  ok: boolean;
  /** 是否勾选从其他命令移除引用（总开关）。 */
  removeFromOthers: boolean;
  /**
   * 当 removeFromOthers 为 true 时，仅从这些条目对应规则的前/后置列表中移除被引用命令 id；
   * 为 false 或未选主开关时为空数组。
   */
  referrerEntriesToStrip: HookReferrerEntry[];
};

export type HookDependencyConfirmModalRef = ModalRef<'modal', HookDependencyConfirmModalData, HookDependencyConfirmModalResult>;

/**
 * 前置/后置命令依赖确认弹窗：列出引用当前命令的其他命令；禁用流程下每条引用可单独勾选，
 * 与底部「从其他命令移除引用」主开关配合，仅移除已勾选条目对应的前/后置 id。
 *
 * @param _props 透传属性（由 use-modal-ref 管理）。
 * @param ref 弹窗 ref。
 * @returns React 元素。
 */
export const HookDependencyConfirmModal = forwardRef<HookDependencyConfirmModalRef>(function HookDependencyConfirmModal(
  _props,
  ref,
): React.ReactElement | null {
  const { modal, data } = useModalRef<HookDependencyConfirmModalData, HookDependencyConfirmModalResult>(ref, {
    title: '',
    intro: '',
    referrerBlocks: [],
    referrerRows: [],
    referrerRowCheckboxAria: '',
    cancelText: '取消',
    okText: '确定',
    danger: true,
    showRemoveFromOthersCheckbox: false,
    removeFromOthersLabel: '',
  });

  const [removeFromOthers, setRemoveFromOthers] = useState(false);
  const [rowChecked, setRowChecked] = useState<Record<string, boolean>>({});

  const rows = data.referrerRows ?? [];
  const rowGroups = useMemo(() => {
    const map = new Map<string, { commandTitle: string; commandId: string; rows: HookReferrerRow[] }>();
    for (const r of rows) {
      const e = r.entry;
      const prev = map.get(e.sourceCommandId);
      if (!prev) {
        map.set(e.sourceCommandId, {
          commandTitle: e.sourceTitle || e.sourceCommandId,
          commandId: e.sourceCommandId,
          rows: [r],
        });
      } else {
        prev.rows.push(r);
      }
    }
    return Array.from(map.values());
  }, [rows]);

  const rowsKey = useMemo(() => rows.map((r) => r.key).sort().join('\n'), [rows]);

  useLayoutEffect(() => {
    if (!modal.visible) return;
    setRemoveFromOthers(Boolean(data.showRemoveFromOthersCheckbox));
    const init: Record<string, boolean> = {};
    for (const r of data.referrerRows ?? []) {
      init[r.key] = true;
    }
    setRowChecked(init);
  }, [modal.visible, data.showRemoveFromOthersCheckbox, rowsKey]);

  const onCancel = () => void modal.endModal({ ok: false, removeFromOthers: false, referrerEntriesToStrip: [] });

  const onOk = () => {
    const stripEntries =
      removeFromOthers && rows.length > 0 ? rows.filter((r) => rowChecked[r.key] !== false).map((r) => r.entry) : [];
    void modal.endModal({ ok: true, removeFromOthers, referrerEntriesToStrip: stripEntries });
  };

  return (
    <Modal
      open={modal.visible}
      title={data.title}
      onCancel={onCancel}
      width={520}
      footer={
        <div className="rrHookDepConfirm__footer">
          <Button type="default" onClick={onCancel}>
            {data.cancelText}
          </Button>
          <Button type="primary" className={data.danger ? 'rrHookDepConfirm__okDanger' : undefined} onClick={onOk}>
            {data.okText}
          </Button>
        </div>
      }
    >
      <div className="rrHookDepConfirm">
        <div className="rrHookDepConfirm__intro">{data.intro}</div>
        {rows.length > 0 ? (
          <div className="rrHookDepConfirm__listWrap">
            <ul className="rrHookDepConfirm__blocks">
              {rowGroups.map((g) => (
                <li key={g.commandId} className="rrHookDepConfirm__block">
                  <div className="rrHookDepConfirm__blockTitle">
                    {g.commandTitle}
                    <span className="rrHookDepConfirm__blockId"> ({g.commandId})</span>
                  </div>
                  <ul className="rrHookDepConfirm__items rrHookDepConfirm__items--rows">
                    {g.rows.map((r) => (
                      <li key={r.key} className="rrHookDepConfirm__row">
                        <label className="rrHookDepConfirm__rowLabel">
                          <input
                            type="checkbox"
                            data-rr-hook-dep-row={r.key}
                            checked={rowChecked[r.key] !== false}
                            onChange={(e) => setRowChecked((prev) => ({ ...prev, [r.key]: e.target.checked }))}
                            aria-label={data.referrerRowCheckboxAria || r.label}
                          />
                          <span>{r.label}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ) : data.referrerBlocks.length ? (
          <div className="rrHookDepConfirm__listWrap">
            <ul className="rrHookDepConfirm__blocks">
              {data.referrerBlocks.map((b) => (
                <li key={b.commandId} className="rrHookDepConfirm__block">
                  <div className="rrHookDepConfirm__blockTitle">
                    {b.commandTitle}
                    <span className="rrHookDepConfirm__blockId"> ({b.commandId})</span>
                  </div>
                  <ul className="rrHookDepConfirm__items">
                    {b.items.map((line, i) => (
                      <li key={`${b.commandId}-${i}`}>{line}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {data.showRemoveFromOthersCheckbox ? (
          <div className="rrHookDepConfirm__checkboxRow">
            <label className="rrHookDepConfirm__checkLabel">
              <input
                type="checkbox"
                data-rr-hook-dep-master
                checked={removeFromOthers}
                onChange={(e) => setRemoveFromOthers(e.target.checked)}
                aria-label={data.removeFromOthersLabel}
              />
              <span>{data.removeFromOthersLabel}</span>
            </label>
          </div>
        ) : null}
      </div>
    </Modal>
  );
});

HookDependencyConfirmModal.displayName = 'HookDependencyConfirmModal';
