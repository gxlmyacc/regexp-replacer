import React, { memo, useMemo } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReplaceCommand } from '../../../src/types';
import { Tooltip } from './base';
import { AutoEllipsis, Button, Icon, Input, Tag } from './base';
import './LeftPanel.scss';

type Strings = {
  searchPlaceholder: string;
  commandListTitle: string;
  newCommand: string;
  export: string;
  import: string;
  ruleLabel: string;
  enabled: string;
  disabled: string;
  renameCommand: string;
  deleteCommand: string;
  deleteRule: string;
  confirmDeleteCommand: string;
  confirmDeleteRule: string;
};

export type LeftPanelProps = {
  leftWidth: number;
  t: Strings;
  commands: ReplaceCommand[];
  filtered: ReplaceCommand[];
  search: string;
  selectedId?: string;
  selectedRuleIndex: number;
  isUntitledCommandTitle: (title: string) => boolean;
  isCommandDeletable: (cmd: ReplaceCommand) => boolean;
  isCommandDirty: (cmd: ReplaceCommand) => boolean;
  isRuleDirty: (cmd: ReplaceCommand, ruleIndex: number) => boolean;
  onChangeSearch: (value: string) => void;
  onClickExport: () => void;
  onClickImport: () => void;
  onClickNewCommand: () => void;
  isNewCommandDisabled: boolean;
  newCommandDisabledTitle?: string;
  onSelectCommand: (cmdId: string) => void;
  onSelectRule: (ruleIndex: number) => void;
  onRenameCommand: (cmdId: string, currentTitle: string) => void;
  onReorderCommands: (nextCmdIds: string[]) => void;
  onDeleteCommand: (cmdId: string) => void;
  onDeleteRule: (cmdId: string, ruleIndex: number) => void;
  onConfirm: (message: string) => Promise<boolean>;
  getRuleUids: (cmdId: string) => string[];
  onReorderRules: (cmdId: string, nextRuleUids: string[]) => void;
};

type SortableCommandItemProps = {
  uid: string;
  label: string;
  dirty: boolean;
  disabled: boolean;
  disabledLabel: string;
  subLabel: string;
  active: boolean;
  showRename: boolean;
  showDelete: boolean;
  renameTooltip: string;
  deleteTooltip: string;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
};

/**
 * 可拖拽排序的命令项（仅手柄可拖动）。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
function SortableCommandItem(props: SortableCommandItemProps): React.ReactElement {
  const {
    uid,
    label,
    dirty,
    disabled,
    disabledLabel,
    subLabel,
    active,
    showRename,
    showDelete,
    renameTooltip,
    deleteTooltip,
    onClick,
    onRename,
    onDelete,
  } = props;
  const sortable = useSortable({ id: uid, disabled: !showRename });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div ref={sortable.setNodeRef} style={style} className={`commandItem ${active ? 'commandItemActive' : ''}`} onClick={onClick}>
      <div className="commandRow">
        {sortable.isDragging ? (
          <span
            className="rrCommandDragHandle"
            aria-label="拖拽排序"
            {...sortable.attributes}
            {...sortable.listeners}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Icon type="dragHandle" />
          </span>
        ) : (
          <Tooltip content="可拖拽调整顺序" useChildAsHost>
            <span
              className="rrCommandDragHandle"
              aria-label="拖拽排序"
              {...sortable.attributes}
              {...sortable.listeners}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <Icon type="dragHandle" />
            </span>
          </Tooltip>
        )}
        <div className="commandMeta">
          <AutoEllipsis className="commandTitle" content={label} block>
            {label}
            {dirty ? <span className="rrDirtyStar">*</span> : ''}
          </AutoEllipsis>
          <div className="commandSubRow">
            {disabled ? (
              <Tag size="sm" className="rrRuleStateTag rrRuleStateTag--disabled">
                {disabledLabel}
              </Tag>
            ) : null}
            <span className="commandId">{subLabel}</span>
          </div>
        </div>
        <div className="commandActionsOverlay">
          {showRename ? (
            <Tooltip content={renameTooltip}>
              <Button
                variant="icon"
                size="xs"
                className="iconBtn"
                aria-label="Rename command"
                onClick={(e) => {
                  e.stopPropagation();
                  onRename();
                }}
              >
                <Icon type="edit" />
              </Button>
            </Tooltip>
          ) : null}
          {showDelete ? (
            <Tooltip content={deleteTooltip}>
              <Button
                variant="icon"
                size="xs"
                className="iconBtn"
                aria-label="Delete command"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Icon type="close" />
              </Button>
            </Tooltip>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type SortableRuleItemProps = {
  uid: string;
  label: string;
  active: boolean;
  dirty: boolean;
  enabled: boolean;
  disabledLabel: string;
  deleteTooltip: string;
  deletable: boolean;
  onClick: () => void;
  onDelete: () => void;
};

/**
 * 可拖拽排序的规则子项（仅手柄可拖动）。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
function SortableRuleItem(props: SortableRuleItemProps): React.ReactElement {
  const { uid, label, active, dirty, enabled, disabledLabel, deleteTooltip, deletable, onClick, onDelete } = props;
  const sortable = useSortable({ id: uid });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={`commandItem rrRuleItem ${active ? 'commandItemActive' : ''}`}
      onClick={onClick}
    >
      <div className="rrRuleRow">
        <span className="rrRuleMain">
          <Tooltip content="拖拽排序">
            <span
              style={{ opacity: 0.7, cursor: 'grab', userSelect: 'none', flex: 'none' }}
              aria-label="拖拽排序"
              {...sortable.attributes}
              {...sortable.listeners}
              onMouseDown={(e) => e.stopPropagation()}
            >
                  <Icon type="dragHandle" />
            </span>
          </Tooltip>
          <span style={{ minWidth: 0 }}>
            <AutoEllipsis className="leftPanelEllipsisText" content={label}>
              {label}
              {dirty ? <span className="rrDirtyStar">*</span> : ''}
            </AutoEllipsis>
          </span>
        </span>
        <span className="rrRuleMeta">
          {!enabled ? (
            <Tag size="sm" className="rrRuleStateTag rrRuleStateTag--disabled">
              {disabledLabel}
            </Tag>
          ) : null}
        </span>
      </div>
      {deletable ? (
        <div className="rrRuleActionsOverlay">
          <Tooltip content={deleteTooltip}>
            <Button
              variant="icon"
              size="xs"
              className="iconBtn"
              aria-label="Delete rule"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Icon type="close" />
            </Button>
          </Tooltip>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 左侧菜单面板：搜索、导入导出、命令/规则列表。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const LeftPanel = memo(function LeftPanel(props: LeftPanelProps): React.ReactElement {
  const {
    leftWidth,
    t,
    commands,
    filtered,
    search,
    selectedId,
    selectedRuleIndex,
    isUntitledCommandTitle,
    isCommandDeletable,
    isCommandDirty,
    isRuleDirty,
    onChangeSearch,
    onClickExport,
    onClickImport,
    onClickNewCommand,
    isNewCommandDisabled,
    newCommandDisabledTitle,
    onSelectCommand,
    onSelectRule,
    onRenameCommand,
    onReorderCommands,
    onDeleteCommand,
    onDeleteRule,
    onConfirm,
    getRuleUids,
    onReorderRules,
  } = props;

  const savedCount = commands.filter((c) => !isUntitledCommandTitle(c.title)).length;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const canDragCommands = search.trim() === '' && filtered.length === commands.length && savedCount > 1;
  const cmdIds = useMemo(() => commands.map((c) => c.id), [commands]);

  return (
    <div className="leftPanel" style={{ minWidth: leftWidth }}>
      <div className="leftHeader">
        <div className="leftTopRow">
          <div className="leftTopTitle">{t.commandListTitle.replace('{n}', String(savedCount))}</div>
          <div className="leftTopActions">
            <Tooltip content={isNewCommandDisabled ? (newCommandDisabledTitle ?? t.newCommand) : t.newCommand}>
              <Button
                preset="topIcon"
                type="primary"
                onClick={onClickNewCommand}
                aria-label={t.newCommand}
                disabled={isNewCommandDisabled}
              >
                <Icon type="add" />
              </Button>
            </Tooltip>
            <Tooltip content={t.export}>
              <Button preset="topIcon" onClick={onClickExport} aria-label={t.export}>
                <Icon type="export" />
              </Button>
            </Tooltip>
            <Tooltip content={t.import}>
              <Button preset="topIcon" onClick={onClickImport} aria-label={t.import}>
                <Icon type="import" />
              </Button>
            </Tooltip>
          </div>
        </div>
        <Input variant="search" value={search} onChange={(e) => onChangeSearch(e.target.value)} placeholder={t.searchPlaceholder} />
      </div>

      <div className="commandList">
        {canDragCommands ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(ev: DragEndEvent) => {
              const fromId = String(ev.active?.id ?? '');
              const toId = String(ev.over?.id ?? '');
              if (!fromId || !toId || fromId === toId) return;
              const fromIdx = cmdIds.indexOf(fromId);
              const toIdx = cmdIds.indexOf(toId);
              if (fromIdx < 0 || toIdx < 0) return;
              onReorderCommands(arrayMove(cmdIds, fromIdx, toIdx));
            }}
          >
            <SortableContext items={cmdIds}>
              {filtered.map((c) => {
                const isActiveCmd = c.id === (selectedId ?? '');
                const showCmdDelete = isCommandDeletable(c);
                const cmdDirty = isCommandDirty(c);
                const cmdEnabled = c.rules.some((r) => r.enable !== false);
                const cmdDisabled = !cmdEnabled;
                return (
                  <div key={c.id}>
                    <SortableCommandItem
                      uid={c.id}
                      label={c.title}
                      dirty={cmdDirty}
                      disabled={cmdDisabled}
                      disabledLabel={t.disabled}
                      subLabel={c.id}
                      active={isActiveCmd}
                      showRename={!isUntitledCommandTitle(c.title)}
                      showDelete={showCmdDelete}
                      renameTooltip={t.renameCommand}
                      deleteTooltip={t.deleteCommand}
                      onClick={() => onSelectCommand(c.id)}
                      onRename={() => onRenameCommand(c.id, c.title)}
                      onDelete={() => void onDeleteCommand(c.id)}
                    />

                    {isActiveCmd && c.rules.length > 1 ? (
                      <div style={{ paddingLeft: 10, paddingBottom: 6 }}>
                        {(() => {
                          const uids = getRuleUids(c.id);
                          const items = uids.slice(0, c.rules.length);
                          if (items.length <= 1) return null;

                          /**
                           * 处理规则拖拽结束事件，并写回新顺序。
                           *
                           * @param ev 拖拽结束事件。
                           * @returns 无返回值。
                           */
                          function onDragEnd(ev2: DragEndEvent): void {
                            const fromId = String(ev2.active?.id ?? '');
                            const toId = String(ev2.over?.id ?? '');
                            if (!fromId || !toId || fromId === toId) return;
                            const fromIdx = items.indexOf(fromId);
                            const toIdx = items.indexOf(toId);
                            if (fromIdx < 0 || toIdx < 0) return;
                            onReorderRules(c.id, arrayMove(items, fromIdx, toIdx));
                          }

                          return (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                              <SortableContext items={items}>
                                {c.rules.map((r, idx) => {
                                  const uid = items[idx] ?? String(idx);
                                  const isActiveRule = idx === selectedRuleIndex;
                                  const showRuleDelete = c.rules.length > 1;
                                  const ruleDirty = isRuleDirty(c, idx);
                                  const ruleEnabled = r.enable !== false;
                                  const ruleTitle = (r as { title?: string } | undefined)?.title;
                                  const ruleLabel = ruleTitle ? ruleTitle : `${t.ruleLabel} ${idx + 1}`;
                                  return (
                                    <div key={uid} style={{ marginTop: 4 }}>
                                      <SortableRuleItem
                                        uid={uid}
                                        label={ruleLabel}
                                        active={isActiveRule}
                                        dirty={ruleDirty}
                                        enabled={ruleEnabled}
                                        disabledLabel={t.disabled}
                                        deleteTooltip={t.deleteRule}
                                        deletable={showRuleDelete}
                                        onClick={() => onSelectRule(idx)}
                                        onDelete={() => {
                                          void (async () => {
                                            const ok = await onConfirm(t.confirmDeleteRule);
                                            if (!ok) return;
                                            onDeleteRule(c.id, idx);
                                          })();
                                        }}
                                      />
                                    </div>
                                  );
                                })}
                              </SortableContext>
                            </DndContext>
                          );
                        })()}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </SortableContext>
          </DndContext>
        ) : (
          filtered.map((c) => {
            const isActiveCmd = c.id === (selectedId ?? '');
            const showCmdDelete = isCommandDeletable(c);
            const cmdDirty = isCommandDirty(c);
            const cmdEnabled = c.rules.some((r) => r.enable !== false);
            const cmdDisabled = !cmdEnabled;
            return (
              <div key={c.id}>
                <div className={`commandItem ${isActiveCmd ? 'commandItemActive' : ''}`} onClick={() => onSelectCommand(c.id)}>
                  <div className="commandRow">
                    <div className="commandMeta">
                      <AutoEllipsis className="commandTitle" content={c.title} block>
                        {c.title}
                        {cmdDirty ? ' *' : ''}
                      </AutoEllipsis>
                      <div className="commandSubRow">
                        {cmdDisabled ? (
                          <Tag size="sm" className="rrRuleStateTag rrRuleStateTag--disabled">
                            {t.disabled}
                          </Tag>
                        ) : null}
                        <span className="commandId">{c.id}</span>
                      </div>
                    </div>
                    <div className="commandActionsOverlay">
                      {!isUntitledCommandTitle(c.title) ? (
                        <Tooltip content={t.renameCommand}>
                          <Button
                            variant="icon"
                            size="xs"
                            className="iconBtn"
                            aria-label="Rename command"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRenameCommand(c.id, c.title);
                            }}
                          >
                            <Icon type="edit" />
                          </Button>
                        </Tooltip>
                      ) : null}
                      {showCmdDelete ? (
                        <Tooltip content={t.deleteCommand}>
                          <Button
                            variant="icon"
                            size="xs"
                            className="iconBtn"
                            aria-label="Delete command"
                            onClick={(e) => {
                              e.stopPropagation();
                              void onDeleteCommand(c.id);
                            }}
                          >
                            <Icon type="close" />
                          </Button>
                        </Tooltip>
                      ) : null}
                    </div>
                  </div>
                </div>

                {isActiveCmd && c.rules.length > 1 ? (
                  <div style={{ paddingLeft: 10, paddingBottom: 6 }}>
                    {(() => {
                      const uids = getRuleUids(c.id);
                      const items = uids.slice(0, c.rules.length);
                      if (items.length <= 1) return null;

                      /**
                       * 处理规则拖拽结束事件，并写回新顺序。
                       *
                       * @param ev 拖拽结束事件。
                       * @returns 无返回值。
                       */
                      function onDragEnd(ev: DragEndEvent): void {
                        const fromId = String(ev.active?.id ?? '');
                        const toId = String(ev.over?.id ?? '');
                        if (!fromId || !toId || fromId === toId) return;
                        const fromIdx = items.indexOf(fromId);
                        const toIdx = items.indexOf(toId);
                        if (fromIdx < 0 || toIdx < 0) return;
                        onReorderRules(c.id, arrayMove(items, fromIdx, toIdx));
                      }

                      return (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                          <SortableContext items={items}>
                            {c.rules.map((r, idx) => {
                              const uid = items[idx] ?? String(idx);
                              const isActiveRule = idx === selectedRuleIndex;
                              const showRuleDelete = c.rules.length > 1;
                              const ruleDirty = isRuleDirty(c, idx);
                              const ruleEnabled = r.enable !== false;
                              const ruleTitle = (r as { title?: string } | undefined)?.title;
                              const ruleLabel = ruleTitle ? ruleTitle : `${t.ruleLabel} ${idx + 1}`;
                              return (
                                <div key={uid} style={{ marginTop: 4 }}>
                                  <SortableRuleItem
                                    uid={uid}
                                    label={ruleLabel}
                                    active={isActiveRule}
                                    dirty={ruleDirty}
                                    enabled={ruleEnabled}
                                    disabledLabel={t.disabled}
                                    deleteTooltip={t.deleteRule}
                                    deletable={showRuleDelete}
                                    onClick={() => onSelectRule(idx)}
                                    onDelete={() => {
                                      void (async () => {
                                        const ok = await onConfirm(t.confirmDeleteRule);
                                        if (!ok) return;
                                        onDeleteRule(c.id, idx);
                                      })();
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </SortableContext>
                        </DndContext>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

