import React, { memo, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AutoEllipsis, Tag } from './base';
import './HookChipsBar.scss';

export type HookChipItem = {
  id: string;
  label: string;
  title?: string;
};

export type HookChipsBarProps = {
  title?: string;
  items: HookChipItem[];
  onRemove: (id: string) => void;
  onReorder?: (nextIds: string[]) => void;
  className?: string;
};

type SortableHookChipProps = {
  id: string;
  label: string;
  title?: string;
  draggable: boolean;
  onRemove: (id: string) => void;
};

/**
 * 可排序的 hook 标签项（基于 dnd-kit 的 useSortable）。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
function SortableHookChip(props: SortableHookChipProps): React.ReactElement {
  const { id, label, title, draggable, onRemove } = props;
  const sortable = useSortable({ id, disabled: !draggable });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0 : 1, // 拖拽时本体作为占位，真实内容由 DragOverlay 展示
  };

  return (
    <Tag
      ref={sortable.setNodeRef}
      style={style}
      className={`hookChip ${sortable.isDragging ? 'hookChipDragging hookChipPlaceholder' : ''}`}
      {...sortable.attributes}
      {...sortable.listeners}
      onClose={() => onRemove(id)}
      closeAriaLabel="删除"
      closeClassName="hookChipRemove"
    >
      <AutoEllipsis className="hookChipText" content={title ?? label}>
        {label}
      </AutoEllipsis>
    </Tag>
  );
}

type HookChipOverlayProps = {
  label: string;
  title?: string;
};

/**
 * 拖拽时显示的浮层预览标签（不响应点击）。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
function HookChipOverlay(props: HookChipOverlayProps): React.ReactElement {
  const { label } = props;
  return (
    <Tag className="hookChip hookChipOverlay">
      <span className="hookChipText">{label}</span>
      <span className="hookChipRemove" aria-hidden="true" />
    </Tag>
  );
}

/**
 * hook 命令标签栏组件，用于展示已选中的前置/后置命令，并支持删除以调整执行链。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const HookChipsBar = memo(function HookChipsBar(props: HookChipsBarProps): React.ReactElement | null {
  const { title, items, onRemove, onReorder, className } = props;
  const idList = useMemo(() => items.map((x) => x.id), [items]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);

  if (!items.length) return null;

  /**
   * 处理拖拽开始事件，记录 activeId 以展示 DragOverlay。
   *
   * @param ev 拖拽开始事件。
   * @returns 无返回值。
   */
  function onDragStart(ev: DragStartEvent): void {
    if (!onReorder) return;
    const fromId = String(ev.active?.id ?? '');
    setActiveId(fromId || null);
  }

  /**
   * 处理拖拽结束事件，并在必要时写回新顺序。
   *
   * @param ev 拖拽结束事件。
   * @returns 无返回值。
   */
  function onDragEnd(ev: DragEndEvent): void {
    if (!onReorder) return;
    const fromId = String(ev.active?.id ?? '');
    const toId = String(ev.over?.id ?? '');
    setActiveId(null);
    if (!fromId || !toId || fromId === toId) return;
    const fromIdx = idList.indexOf(fromId);
    const toIdx = idList.indexOf(toId);
    if (fromIdx < 0 || toIdx < 0) return;
    onReorder(arrayMove(idList, fromIdx, toIdx));
  }

  return (
    <div className={`hookChipsBar ${className ?? ''}`.trim()}>
      <div className="hookChips">
        {title ? <div className="hookChipsTitle">{title}</div> : null}
        {onReorder ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext items={idList}>
              {items.map((it) => (
                <SortableHookChip
                  key={it.id}
                  id={it.id}
                  label={it.label}
                  title={it.title}
                  draggable={true}
                  onRemove={onRemove}
                />
              ))}
            </SortableContext>
            <DragOverlay>
              {activeId ? (
                (() => {
                  const it = items.find((x) => x.id === activeId);
                  if (!it) return null;
                  return <HookChipOverlay label={it.label} title={it.title} />;
                })()
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          items.map((it) => (
            <Tag key={it.id} className="hookChip" onClose={() => onRemove(it.id)} closeAriaLabel="删除" closeClassName="hookChipRemove">
              <AutoEllipsis className="hookChipText" content={it.title ?? it.label}>
                {it.label}
              </AutoEllipsis>
            </Tag>
          ))
        )}
      </div>
    </div>
  );
});

