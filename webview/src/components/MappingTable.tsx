import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Tooltip } from './base';
import { Button, Icon, Input, MoveUpDownButtons, Popover } from './base';
import type { LanguageCode } from '../i18n';
import { RegexExpressionEditor } from './RegexExpressionEditor';
import { ReplacementTemplateField } from './ReplacementTemplateField';
import { createId } from '../utils';
import { collectCapturingGroupOpenOffsets } from '../utils/regexCaptureGroupScan';
import { Toast } from './base';
import './MappingTable.scss';

export type MappingRow = {
  uid: string;
  find: string;
  replace: string;
};

export type MappingTableStrings = {
  title: string;
  colMatch: string;
  colReplace: string;
  /** 勾选“正则”后，匹配列的标题（可选）。 */
  colExpr?: string;
  /** 勾选“正则”后，替换列的标题（可选）。 */
  colTemplate?: string;
  /** “正则”复选框提示文本。 */
  regexModeLabel?: string;
  /** “正则”复选框气泡提示（说明勾选后的效果）。 */
  regexModeTip?: string;
  addRow: string;
  deleteRow: string;
  duplicateKey: string;
  /** 匹配列为空时的失焦提示（与保存校验文案一致）。 */
  matchRequired?: string;
  matchHelp?: string;
};

export type MapReplaceMode = 'text' | 'regex';

export type MapReplaceItem = {
  find: string;
  replace: string;
};

export type MapReplaceConfig = {
  mode: MapReplaceMode;
  cases: MapReplaceItem[];
};

export type MappingTableProps = {
  map: MapReplaceConfig | undefined;
  onChangeMap: (nextMap: MapReplaceConfig) => void;
  uiLanguage: LanguageCode;
  t: MappingTableStrings;
};

/**
 * 映射表编辑器：支持纯文本/正则两种模式，以自上而下优先级的规则列表维护替换项，并写回到 rule.map。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const MappingTable = memo(function MappingTable(props: MappingTableProps): React.ReactElement {
  const { map, onChangeMap, uiLanguage, t } = props;
  const [rows, setRows] = useState<MappingRow[]>([{ uid: createId(), find: '', replace: '' }]);
  const [errorFinds, setErrorFinds] = useState<Set<string>>(() => new Set());
  /** 仅在「匹配」失焦校验发现为空后记录 uid，避免未编辑的默认空白行一上来就标红。 */
  const [emptyMatchWarnUids, setEmptyMatchWarnUids] = useState<Set<string>>(() => new Set());
  const skipNextSyncFromEffectRef = useRef<boolean>(false);
  const rowsRef = useRef<MappingRow[]>(rows);
  const [hoverUid, setHoverUid] = useState<string | null>(null);
  const [hoverEl, setHoverEl] = useState<HTMLElement | null>(null);
  const hoverKeepRef = useRef<{ overRow: boolean; overFloat: boolean }>({ overRow: false, overFloat: false });
  const closeTimerRef = useRef<number | null>(null);

  const mapKey = useMemo(() => {
    try {
      return JSON.stringify(map ?? {});
    } catch {
      return '';
    }
  }, [map]);

  const mode: MapReplaceMode = (map?.mode ?? 'text') as MapReplaceMode;

  /**
   * 当 map 变化来自本组件内部输入时，跳过重建 rows，避免输入框因 key/引用变化而失焦。
   */
  useEffect(() => {
    if (skipNextSyncFromEffectRef.current) {
      skipNextSyncFromEffectRef.current = false;
      return;
    }
    const cases = (map?.cases ?? []).map((x) => ({ uid: createId(), find: String(x.find ?? ''), replace: String(x.replace ?? '') }));
    setRows(cases.length > 0 ? cases : [{ uid: createId(), find: '', replace: '' }]);
    setErrorFinds(new Set());
    setEmptyMatchWarnUids(new Set());
  }, [mapKey]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  /**
   * 安排一次“悬浮按钮关闭”检查：只有当鼠标不在行内且不在悬浮层内时才真正关闭。
   *
   * @returns 无返回值。
   */
  function scheduleCloseHover(): void {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      const keep = hoverKeepRef.current.overRow || hoverKeepRef.current.overFloat;
      if (!keep) {
        setHoverUid(null);
        setHoverEl(null);
      }
    }, 140);
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  /**
   * 将当前行数据转换为可落盘的 cases（过滤空 find）。
   *
   * @param list 行列表。
   * @returns cases 对象。
   */
  function rowsToList(list: MappingRow[]): MapReplaceItem[] {
    const out: MapReplaceItem[] = [];
    for (const r of list) {
      if (!r.find) continue;
      out.push({ find: r.find, replace: r.replace ?? '' });
    }
    return out;
  }

  /**
   * 触发一次去重校验：若 find 重复则标记错误并 toast 提示。
   *
   * @param list 行列表。
   * @returns 是否通过校验。
   */
  function validateUniqueMatch(list: MappingRow[]): boolean {
    const dup = new Set<string>();
    const seen = new Set<string>();
    for (const r of list) {
      if (!r.find) continue;
      if (seen.has(r.find)) dup.add(r.find);
      seen.add(r.find);
    }
    setErrorFinds(dup);
    if (dup.size > 0) {
      Toast.show(t.duplicateKey, 'error');
      return false;
    }
    const hasEmpty = list.some((r) => !String(r.find ?? '').trim());
    if (hasEmpty) {
      setEmptyMatchWarnUids((prev) => {
        const next = new Set(prev);
        for (const r of list) {
          if (!String(r.find ?? '').trim()) next.add(r.uid);
        }
        return next;
      });
      const msg =
        t.matchRequired ??
        (uiLanguage === 'zh-CN' ? '映射表每一行的「匹配」不能为空。' : 'Each mapping row must have a non-empty Match value.');
      Toast.show(msg, 'error');
      return false;
    }
    return true;
  }

  /**
   * 去重校验（静默模式）：仅更新错误标记，不触发 toast。
   *
   * @param list 行列表。
   * @returns 无返回值。
   */
  function validateUniqueMatchSilent(list: MappingRow[]): void {
    const dup = new Set<string>();
    const seen = new Set<string>();
    for (const r of list) {
      if (!r.find) continue;
      if (seen.has(r.find)) dup.add(r.find);
      seen.add(r.find);
    }
    setErrorFinds(dup);
    setEmptyMatchWarnUids((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<string>();
      for (const uid of prev) {
        const row = list.find((x) => x.uid === uid);
        if (row && !String(row.find ?? '').trim()) next.add(uid);
      }
      return next.size === prev.size && [...prev].every((u) => next.has(u)) ? prev : next;
    });
  }

  /**
   * 将当前 rows 与 mode 写回 rule.map。
   *
   * @param nextRows 下一轮 rows。
   * @param nextMode 下一轮 mode。
   * @returns 无返回值。
   */
  function commitToMap(nextRows: MappingRow[], nextMode: MapReplaceMode): void {
    onChangeMap({ mode: nextMode, cases: rowsToList(nextRows) });
  }

  /**
   * 更新某一行，并将变更写回 map（仅当唯一性校验通过时写回）。
   *
   * @param idx 行索引。
   * @param patch 更新字段。
   * @returns 无返回值。
   */
  function updateRow(idx: number, patch: Partial<MappingRow>): void {
    setRows((prev) => {
      const next = prev.map((x, i) => (i === idx ? { ...x, ...patch } : x));
      // 允许用户暂时输入重复值，但只有在失焦校验通过后才落盘；
      // 这里仍同步更新 map，以便预览及时反映最新输入。
      skipNextSyncFromEffectRef.current = true;
      commitToMap(next, mode);
      validateUniqueMatchSilent(next);
      return next;
    });
  }

  /**
   * 新增一行空白映射项。
   *
   * @returns 无返回值。
   */
  function addRow(): void {
    setRows((prev) => {
      const next = [...prev, { uid: createId(), find: '', replace: '' }];
      skipNextSyncFromEffectRef.current = true;
      commitToMap(next, mode);
      return next;
    });
  }

  /**
   * 删除指定行，并写回 map。
   *
   * @param idx 行索引。
   * @returns 无返回值。
   */
  function deleteRow(idx: number): void {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      const ensured = next.length > 0 ? next : [{ uid: createId(), find: '', replace: '' }];
      skipNextSyncFromEffectRef.current = true;
      commitToMap(ensured, mode);
      // 删除后也重新做一次校验，清掉可能的错误态
      validateUniqueMatchSilent(ensured);
      return ensured;
    });
  }

  /**
   * 将某一行向上/向下移动 1 位，并写回 map。
   *
   * @param fromIdx 原始行索引。
   * @param toIdx 目标行索引。
   * @returns 无返回值。
   */
  function moveRow(fromIdx: number, toIdx: number): void {
    setRows((prev) => {
      if (fromIdx === toIdx) return prev;
      if (fromIdx < 0 || fromIdx >= prev.length) return prev;
      if (toIdx < 0 || toIdx >= prev.length) return prev;
      const next = [...prev];
      const [picked] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, picked);
      skipNextSyncFromEffectRef.current = true;
      commitToMap(next, mode);
      validateUniqueMatchSilent(next);
      return next;
    });
  }

  /**
   * 切换映射表模式（纯文本/正则），并写回 map.mode。
   *
   * @param nextChecked 是否勾选正则。
   * @returns 无返回值。
   */
  function toggleRegexMode(nextChecked: boolean): void {
    const nextMode: MapReplaceMode = nextChecked ? 'regex' : 'text';
    skipNextSyncFromEffectRef.current = true;
    commitToMap(rows, nextMode);
  }

  const regexLabel = t.regexModeLabel ?? '正则';
  const colLeft = mode === 'regex' ? (t.colExpr ?? t.colMatch) : t.colMatch;
  const colRight = mode === 'regex' ? (t.colTemplate ?? t.colReplace) : t.colReplace;
  const hoverIdx = hoverUid ? rows.findIndex((x) => x.uid === hoverUid) : -1;
  const hoverValid = hoverIdx >= 0 && hoverIdx < rows.length;
  const canDeleteAny = rows.length > 1;
  const canMoveAny = rows.length > 1;

  return (
    <div className="rrMappingTable">
      <div className="rrMappingTableHeader">
        <div className="rrMappingTableTitle">
          {t.title}
          {t.matchHelp ? (
            <Tooltip content={t.matchHelp}>
              <span className="rrMappingTableHelpIcon" aria-label={t.matchHelp} role="img">
                ?
              </span>
            </Tooltip>
          ) : null}
          {t.regexModeTip ? (
            <Tooltip content={t.regexModeTip}>
              <label className="rrMappingTableRegexToggle">
                <input
                  type="checkbox"
                  checked={mode === 'regex'}
                  aria-label={regexLabel}
                  onChange={(e) => toggleRegexMode(e.target.checked)}
                />
                <span>{regexLabel}</span>
              </label>
            </Tooltip>
          ) : (
            <label className="rrMappingTableRegexToggle">
              <input
                type="checkbox"
                checked={mode === 'regex'}
                aria-label={regexLabel}
                onChange={(e) => toggleRegexMode(e.target.checked)}
              />
              <span>{regexLabel}</span>
            </label>
          )}
        </div>
        <Tooltip content={t.addRow}>
          <Button variant="icon" size="sm" className="rrMappingTableAddBtn" onClick={addRow} aria-label={t.addRow}>
            <Icon type="add" />
          </Button>
        </Tooltip>
      </div>

      <div className="rrMappingTableBody">
        {rows.map((r, idx) => {
          const hasDup = r.find ? errorFinds.has(r.find) : false;
          const emptyFind = !String(r.find ?? '').trim();
          const showEmptyErr = emptyFind && emptyMatchWarnUids.has(r.uid);
          const hasErr = hasDup || showEmptyErr;
          return (
            <div
              key={r.uid}
              className="rrMappingTableRow"
              ref={(el) => {
                if (!el) return;
                if (hoverUid === r.uid) setHoverEl(el);
              }}
              onMouseEnter={(e) => {
                hoverKeepRef.current.overRow = true;
                if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
                setHoverUid(r.uid);
                setHoverEl(e.currentTarget as unknown as HTMLElement);
              }}
              onMouseLeave={() => {
                hoverKeepRef.current.overRow = false;
                scheduleCloseHover();
              }}
            >
              <div className="rrMappingTableGrid rrMappingTableGridRow">
                <div className="rrMappingTableCell">
                  {mode === 'regex' ? (
                    <div className={`rrMappingTableExprHost ${hasErr ? 'rrMappingTableExprHost--error' : ''}`.trim()}>
                      <RegexExpressionEditor
                        value={r.find}
                        placeholder={colLeft}
                        uiLanguage={uiLanguage}
                        onChange={(nextValue) => updateRow(idx, { find: nextValue })}
                        onAfterChange={() => {
                          validateUniqueMatchSilent(rowsRef.current);
                        }}
                        onBlur={() => validateUniqueMatch(rowsRef.current)}
                      />
                    </div>
                  ) : (
                    <Input
                      variant="line"
                      value={r.find}
                      onChange={(e) => updateRow(idx, { find: e.target.value })}
                      onBlur={() => validateUniqueMatch(rowsRef.current)}
                      placeholder={colLeft}
                      status={hasErr ? 'error' : undefined}
                    />
                  )}
                </div>
                <div className="rrMappingTableCell">
                  {mode === 'regex' ? (
                    <ReplacementTemplateField
                      value={r.replace}
                      onChange={(nextValue) => updateRow(idx, { replace: nextValue })}
                      placeholder={colRight}
                      highlightEnabled={true}
                      maxCaptureGroupCount={collectCapturingGroupOpenOffsets(r.find).length}
                      variant="line"
                    />
                  ) : (
                    <Input
                      variant="line"
                      value={r.replace}
                      onChange={(e) => updateRow(idx, { replace: e.target.value })}
                      placeholder={colRight}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Popover
        open={Boolean(hoverEl && hoverValid && canMoveAny)}
        referenceEl={hoverEl}
        placement="left"
        offset={4}
        autoFlip={false}
        className="rrMappingTableFloat"
      >
        <div
          className="rrMappingTableFloatInner"
          onMouseEnter={() => {
            hoverKeepRef.current.overFloat = true;
            if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
          }}
          onMouseLeave={() => {
            hoverKeepRef.current.overFloat = false;
            scheduleCloseHover();
          }}
        >
          {hoverValid ? (
            <MoveUpDownButtons
              upDisabled={hoverIdx === 0}
              downDisabled={hoverIdx === rows.length - 1}
              onUp={() => moveRow(hoverIdx, hoverIdx - 1)}
              onDown={() => moveRow(hoverIdx, hoverIdx + 1)}
              upAriaLabel="上移当前条目"
              downAriaLabel="下移当前条目"
            />
          ) : null}
        </div>
      </Popover>

      <Popover
        open={Boolean(hoverEl && hoverValid && canDeleteAny)}
        referenceEl={hoverEl}
        placement="right"
        offset={4}
        autoFlip={false}
        className="rrMappingTableFloat"
      >
        <div
          className="rrMappingTableFloatInner"
          onMouseEnter={() => {
            hoverKeepRef.current.overFloat = true;
            if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
          }}
          onMouseLeave={() => {
            hoverKeepRef.current.overFloat = false;
            scheduleCloseHover();
          }}
        >
          {hoverValid ? (
            <Tooltip content={t.deleteRow}>
              <Button
                variant="icon"
                size="sm"
                className="rrMappingTableDelBtn"
                onClick={() => deleteRow(hoverIdx)}
                aria-label={t.deleteRow}
              >
                <Icon type="close" />
              </Button>
            </Tooltip>
          ) : null}
        </div>
      </Popover>
    </div>
  );
});

