import React from 'react';
import ReactDOM from 'react-dom';
import { describe, expect, test, vi } from 'vitest';
import { LeftPanel } from '../../webview/src/components/LeftPanel';

const t = {
  searchPlaceholder: 'Search',
  commandListTitle: 'Commands ({n})',
  newCommand: 'New command',
  export: 'Export',
  import: 'Import',
  ruleLabel: 'Rule',
  enabled: 'Enabled',
  disabled: 'Disabled',
  renameCommand: 'Rename command',
  deleteCommand: 'Delete command',
  deleteRule: 'Delete rule',
  confirmDeleteCommand: 'Confirm delete command',
  confirmDeleteRule: 'Confirm delete rule',
};

describe('LeftPanel', () => {
  test('单规则命令不显示规则子菜单；点击命令触发选择', () => {
    const onSelectCommand = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    ReactDOM.render(
      <LeftPanel
        leftWidth={240}
        t={t}
        commands={[{ id: 'c1', title: 'A', rules: [{ find: 'x', replace: 'y' }] } as any]}
        filtered={[{ id: 'c1', title: 'A', rules: [{ find: 'x', replace: 'y' }] } as any]}
        search=""
        selectedId={undefined}
        selectedRuleIndex={0}
        isUntitledCommandTitle={() => false}
        isCommandDeletable={() => false}
        isCommandDirty={() => false}
        isRuleDirty={() => false}
        onChangeSearch={() => {}}
        onClickExport={() => {}}
        onClickImport={() => {}}
        onClickNewCommand={() => {}}
        isNewCommandDisabled={false}
        onSelectCommand={onSelectCommand}
        onSelectRule={() => {}}
        onRenameCommand={() => {}}
        onDeleteCommand={() => {}}
        onDeleteRule={() => {}}
        onConfirm={async () => true}
        getRuleUids={() => ['u1']}
        onReorderRules={() => {}}
      />,
      host,
    );
    try {
      const a = Array.from(host.querySelectorAll('.commandTitle')).find((n) => n.textContent === 'A');
      (a as HTMLElement | undefined)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(onSelectCommand).toHaveBeenCalledWith('c1');
      expect(host.querySelector('[aria-label="拖拽排序"]')).toBeNull();
    } finally {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
    }
  });

  test('删除命令会直接回调（确认逻辑由上层统一处理）', async () => {
    const onDeleteCommand = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    ReactDOM.render(
      <LeftPanel
        leftWidth={240}
        t={t}
        commands={[{ id: 'c1', title: 'A', rules: [{ find: 'x', replace: 'y' }, { find: 'a', replace: 'b' }] } as any]}
        filtered={[{ id: 'c1', title: 'A', rules: [{ find: 'x', replace: 'y' }, { find: 'a', replace: 'b' }] } as any]}
        search=""
        selectedId="c1"
        selectedRuleIndex={0}
        isUntitledCommandTitle={() => false}
        isCommandDeletable={() => true}
        isCommandDirty={() => false}
        isRuleDirty={() => false}
        onChangeSearch={() => {}}
        onClickExport={() => {}}
        onClickImport={() => {}}
        onClickNewCommand={() => {}}
        isNewCommandDisabled={false}
        onSelectCommand={() => {}}
        onSelectRule={() => {}}
        onRenameCommand={() => {}}
        onDeleteCommand={onDeleteCommand}
        onDeleteRule={() => {}}
        onConfirm={async () => true}
        getRuleUids={() => ['u1', 'u2']}
        onReorderRules={() => {}}
      />,
      host,
    );
    try {
      const del = host.querySelector('[aria-label="Delete command"]') as HTMLElement | null;
      del?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      expect(onDeleteCommand).toHaveBeenCalledWith('c1');
    } finally {
      ReactDOM.unmountComponentAtNode(host);
      host.remove();
    }
  });
});

