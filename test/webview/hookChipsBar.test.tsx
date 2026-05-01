import React from 'react';
import ReactDOM from 'react-dom';
import * as TestUtils from 'react-dom/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { HookChipsBar } from '../../webview/src/components/HookChipsBar';

type DndProps = {
  onDragStart?: (ev: any) => void;
  onDragEnd?: (ev: any) => void;
  onDragCancel?: () => void;
  children: any;
};

let lastDndProps: DndProps | null = null;

vi.mock('@dnd-kit/core', () => {
  return {
    __esModule: true,
    DndContext: (props: any) => {
      lastDndProps = props;
      return <div className="mockDnd">{props.children}</div>;
    },
    DragOverlay: (props: any) => <div className="mockDragOverlay">{props.children}</div>,
    PointerSensor: class {},
    closestCenter: () => ({}),
    useSensor: () => ({}),
    useSensors: () => ([]),
  };
});

vi.mock('@dnd-kit/sortable', async () => {
  const actual = await vi.importActual<any>('@dnd-kit/sortable');
  return {
    __esModule: true,
    ...actual,
    SortableContext: (props: any) => <div className="mockSortable">{props.children}</div>,
    useSortable: () => ({
      setNodeRef: () => {},
      attributes: {},
      listeners: {},
      transform: null,
      transition: undefined,
      isDragging: false,
    }),
  };
});

/**
 * 将 React 元素挂载到 DOM 容器中（用于无 Testing Library 的最小组件测试）。
 *
 * @param el React 元素。
 * @returns 容器元素。
 */
function mount(el: React.ReactElement): HTMLDivElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  TestUtils.act(() => {
    ReactDOM.render(el, host);
  });
  return host;
}

/**
 * 卸载并移除容器，避免测试间污染。
 *
 * @param host 容器。
 * @returns 无返回值。
 */
function unmount(host: HTMLDivElement): void {
  ReactDOM.unmountComponentAtNode(host);
  host.remove();
}

describe('HookChipsBar', () => {
  test('无 items 返回 null；无 onReorder 时使用静态 Tag，并可删除', () => {
    const onRemove = vi.fn();
    const host0 = mount(<HookChipsBar items={[]} onRemove={onRemove} />);
    try {
      expect(host0.textContent).toBe('');
    } finally {
      unmount(host0);
    }

    const host = mount(
      <HookChipsBar
        title="T"
        items={[
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]}
        onRemove={onRemove}
      />,
    );
    try {
      expect(host.textContent).toContain('T');
      // 点击第一个 close 按钮
      const closeBtn = host.querySelector('button[aria-label="删除"]') as HTMLButtonElement | null;
      expect(closeBtn).not.toBeNull();
      TestUtils.act(() => {
        closeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(onRemove).toHaveBeenCalled();
    } finally {
      unmount(host);
    }
  });

  test('有 onReorder 时：onDragEnd 会触发 arrayMove 写回新顺序', () => {
    const onRemove = vi.fn();
    const onReorder = vi.fn();
    lastDndProps = null;
    const host = mount(
      <HookChipsBar items={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }]} onRemove={onRemove} onReorder={onReorder} />,
    );
    try {
      expect(lastDndProps).not.toBeNull();
      // 模拟拖拽：a -> c
      lastDndProps?.onDragStart?.({ active: { id: 'a' } });
      lastDndProps?.onDragEnd?.({ active: { id: 'a' }, over: { id: 'c' } });
      expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'a']);
      // cancel 会清 activeId（覆盖分支）
      lastDndProps?.onDragCancel?.();
    } finally {
      unmount(host);
    }
  });
});

