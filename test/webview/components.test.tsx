import React from 'react';
import ReactDOM from 'react-dom';
import { describe, expect, test, vi } from 'vitest';
import { ReplaceResultBox } from '../../webview/src/components/ReplaceResultBox';
import { Button, Checkbox, ConfirmModal, Modal, VirtualList } from '../../webview/src/components/base';
import { I18nProvider } from '../../webview/src/i18n/I18nProvider';
import { HookChipsBar } from '../../webview/src/components/HookChipsBar';
import { RenameCommandModal } from '../../webview/src/components/RenameCommandModal';
import { ExplainTabContent } from '../../webview/src/components/ExplainTabContent';
import { MatchDetailsPanel } from '../../webview/src/components/MatchDetailsPanel';

/**
 * 将一个 React 元素挂载到 DOM 容器中（用于无 Testing Library 的最小组件测试）。
 *
 * @param el React 元素。
 * @returns 容器元素。
 */
function mount(el: React.ReactElement): HTMLDivElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  ReactDOM.render(el, host);
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

describe('webview components (minimal)', () => {
  test('VirtualList: renders visible rows and handles scroll', () => {
    // jsdom 默认不包含 ResizeObserver，这里提供一个最小实现
    (globalThis as any).ResizeObserver =
      (globalThis as any).ResizeObserver ??
      class ResizeObserver {
        observe() {}
        disconnect() {}
      };

    const host = mount(
      <VirtualList
        items={[1, 2, 3, 4, 5]}
        rowHeight={20}
        overscan={1}
        renderRow={(it) => <span>{String(it)}</span>}
      />,
    );
    try {
      expect(host.textContent).toContain('1');
      const scroller = host.firstElementChild as HTMLDivElement | null;
      if (scroller) {
        scroller.scrollTop = 40;
        scroller.dispatchEvent(new Event('scroll'));
      }
    } finally {
      unmount(host);
    }
  });

  test('Modal: open=true renders dialog and overlay click triggers onCancel', () => {
    const onCancel = vi.fn();
    const host = mount(
      <Modal open={true} title="T" onCancel={onCancel} footer={null}>
        <div>body</div>
      </Modal>,
    );
    try {
      const overlay = host.querySelector('.rrModal__overlay') as HTMLDivElement | null;
      expect(overlay).not.toBeNull();
      overlay?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onCancel).toHaveBeenCalled();
    } finally {
      unmount(host);
    }
  });

  test('Button: renders children', () => {
    const host = mount(
      <Button type="primary" onClick={() => {}}>
        OK
      </Button>,
    );
    try {
      expect(host.textContent).toContain('OK');
    } finally {
      unmount(host);
    }
  });

  test('ConfirmModal: can render with ref (default hidden)', () => {
    const ref = React.createRef<any>();
    const host = mount(<ConfirmModal ref={ref} />);
    try {
      // 默认 visible=false，不应渲染 rrModal overlay
      expect(host.querySelector('.rrModal__overlay')).toBeNull();
    } finally {
      unmount(host);
    }
  });

  test('RenameCommandModal: can render with ref (default hidden)', () => {
    const ref = React.createRef<any>();
    const host = mount(<RenameCommandModal ref={ref} />);
    try {
      expect(host.querySelector('.rrModal__overlay')).toBeNull();
    } finally {
      unmount(host);
    }
  });

  test('HookChipsBar: renders chips when items provided', () => {
    const host = mount(
      <HookChipsBar
        title="T"
        items={[{ id: 'a', label: 'A' }]}
        onRemove={() => {}}
        onReorder={() => {}}
      />,
    );
    try {
      expect(host.textContent).toContain('A');
    } finally {
      unmount(host);
    }
  });

  test('ExplainTabContent / MatchDetailsPanel: render under I18nProvider', () => {
    const host = mount(
      <I18nProvider>
        <div>
          <ExplainTabContent className="x" />
          <MatchDetailsPanel
            className="y"
            engine="regex"
            flagsDisplay="g"
            current={{ index: 0, startOffset: 0, endOffset: 1, matchText: 'a', groups: [] }}
          />
        </div>
      </I18nProvider>,
    );
    try {
      expect(host.textContent?.length).toBeGreaterThan(0);
    } finally {
      unmount(host);
    }
  });

  test('Checkbox: renders checked state', () => {
    const host = mount(<Checkbox checked={true} onChange={() => {}} tooltip="提示" ariaLabel="提示" />);
    try {
      const input = host.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      expect(input).not.toBeNull();
      expect(input?.checked).toBe(true);
      expect(input?.getAttribute('aria-label')).toBe('提示');
    } finally {
      unmount(host);
    }
  });

  test('ReplaceResultBox: highlightReplaced=false renders plain text (no hit spans)', () => {
    const host = mount(
      <ReplaceResultBox
        parts={[
          { text: 'a', replaced: false },
          { text: 'b', replaced: true },
        ]}
        fallbackText=""
        emptyText="（空）"
        replacedCount={1}
        maxChars={1000}
        highlightReplaced={false}
      />,
    );
    try {
      expect(host.querySelector('.replaceResultBox__lineMain')?.textContent).toBe('ab');
      expect(host.querySelector('.replacePreviewHit')).toBeNull();
    } finally {
      unmount(host);
    }
  });
});

