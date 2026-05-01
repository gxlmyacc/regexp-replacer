import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import * as TestUtils from 'react-dom/test-utils';
import { describe, expect, test, vi } from 'vitest';
import type { ReplaceCommand } from '../../src/types';
import {
  buildSavePayload,
  findFirstUntitledCommand,
  useSaveFlow,
  validateMapRulesBeforeSave,
  validateNamesBeforeSave,
  validateRuleExpressionsBeforeSave,
} from '../../webview/src/features/app/save/saveFlow';
import { createDraftCommand } from '../../webview/src/utils';

function tick(): Promise<void> {
  return new Promise((r) => window.setTimeout(r, 0));
}

describe('saveFlow', () => {
  test('buildSavePayload：会过滤空白未命名草稿', () => {
    const draft = createDraftCommand('Untitled command');
    const payload = buildSavePayload([draft]);
    expect(payload.length).toBe(0);
  });

  test('findFirstUntitledCommand：能识别未命名命令', () => {
    const list: ReplaceCommand[] = [
      { id: 'a', title: 'My', rules: [] as any },
      { id: 'b', title: 'Untitled command', rules: [] as any },
    ];
    expect(findFirstUntitledCommand(list)?.id).toBe('b');
  });

  test('validateMapRulesBeforeSave：非 regex 引擎会阻止保存并 toast', () => {
    const toast = { show: vi.fn() };
    const ok = validateMapRulesBeforeSave(
      [
        {
          id: 'c1',
          title: 'C',
          rules: [{ engine: 'text', find: 'x', replace: 'y', flags: 'g', replaceMode: 'map', map: { mode: 'text', cases: [{ find: 'a', replace: 'b' }] } } as any],
        } as any,
      ],
      { lang: 'zh-CN' as any, t: { nameRequired: '', nameDuplicate: '', nameReservedChars: '', ruleTitleReservedChars: '', ruleLabel: '规则', addRuleFirst: '', confirm: '', cancel: '' }, toast },
    );
    expect(ok).toBe(false);
    expect(toast.show).toHaveBeenCalled();
  });

  test('validateRuleExpressionsBeforeSave：非法正则会阻止保存并 toast', () => {
    const toast = { show: vi.fn() };
    const ok = validateRuleExpressionsBeforeSave(
      [{ id: 'c1', title: 'C', rules: [{ engine: 'regex', find: '(', replace: 'x', flags: 'g' } as any] } as any],
      { lang: 'zh-CN' as any, t: { nameRequired: '', nameDuplicate: '', nameReservedChars: '', ruleTitleReservedChars: '', ruleLabel: '规则', addRuleFirst: '', confirm: '', cancel: '' }, toast },
    );
    expect(ok).toBe(false);
    expect(toast.show).toHaveBeenCalled();
  });

  test('validateNamesBeforeSave：命令名重复会阻止保存并 toast', () => {
    const toast = { show: vi.fn() };
    const ok = validateNamesBeforeSave(
      [
        { id: 'a', title: 'Same', rules: [] as any },
        { id: 'b', title: 'Same', rules: [] as any },
      ] as any,
      {
        lang: 'zh-CN' as any,
        t: {
          nameRequired: 'required',
          nameDuplicate: 'duplicate',
          nameReservedChars: 'reserved',
          ruleTitleReservedChars: 'ruleReserved',
          ruleLabel: '规则',
          addRuleFirst: 'addRuleFirst',
          confirm: 'ok',
          cancel: 'cancel',
        },
        toast,
      },
    );
    expect(ok).toBe(false);
    expect(toast.show).toHaveBeenCalled();
  });

  test('validateNamesBeforeSave：仅校验指定命令时，其他命令的保留字符不阻止通过', () => {
    const toast = { show: vi.fn() };
    const ok = validateNamesBeforeSave(
      [
        { id: 'a', title: 'Demo', rules: [{ engine: 'regex', find: 'x', replace: 'y', flags: 'g' } as any] } as any,
        { id: 'b', title: 'Bad[name]', rules: [{ engine: 'regex', find: 'x', replace: 'y', flags: 'g' } as any] } as any,
      ] as any,
      {
        lang: 'zh-CN' as any,
        t: {
          nameRequired: 'required',
          nameDuplicate: 'duplicate',
          nameReservedChars: 'reserved',
          ruleTitleReservedChars: 'ruleReserved',
          ruleLabel: '规则',
          addRuleFirst: 'addRuleFirst',
          confirm: 'ok',
          cancel: 'cancel',
        },
        toast,
      },
      'a',
    );
    expect(ok).toBe(true);
    expect(toast.show).not.toHaveBeenCalled();
  });

  test('validateNamesBeforeSave：规则标题包含保留字符会阻止保存并按语言拼接提示', () => {
    const toast = { show: vi.fn() };
    const ok = validateNamesBeforeSave(
      [
        {
          id: 'a',
          title: 'Cmd',
          rules: [{ engine: 'regex', find: 'x', replace: 'y', flags: 'g', title: '<bad>' } as any],
        } as any,
      ],
      {
        lang: 'en' as any,
        t: {
          nameRequired: 'required',
          nameDuplicate: 'duplicate',
          nameReservedChars: 'reserved',
          ruleTitleReservedChars: 'ruleReserved',
          ruleLabel: 'Rule',
          addRuleFirst: 'addRuleFirst',
          confirm: 'ok',
          cancel: 'cancel',
        },
        toast,
      },
    );
    expect(ok).toBe(false);
    expect(String(toast.show.mock.calls.at(-1)?.[0] ?? '')).toContain('(Cmd /');
  });

  test('useSaveFlow：当前命令无任何可保存规则时，会 toast 并不发送 setConfig', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const openRenameCommand = vi.fn(async () => {});
    const postMessage = vi.fn();
    const toast = { show: vi.fn() };

    const commands: ReplaceCommand[] = [{ id: 'c1', title: 'C', rules: [{ engine: 'regex', find: '', replace: '', flags: 'g' } as any] } as any];

    function Harness(): React.ReactElement {
      const api = useSaveFlow({
        lang: 'zh-CN' as any,
        t: {
          nameRequired: 'required',
          nameDuplicate: 'duplicate',
          nameReservedChars: 'reserved',
          ruleTitleReservedChars: 'ruleReserved',
          ruleLabel: '规则',
          addRuleFirst: '请先添加规则',
          confirm: 'ok',
          cancel: 'cancel',
        },
        toast,
        commands,
        setCommands: () => {},
        setDirty: () => {},
        selectedId: 'c1',
        selectedIdRef: { current: 'c1' } as any,
        selectedRuleIndex: 0,
        setSelectedRuleIndex: () => {},
        commandsRef: { current: commands } as any,
        savedSnapshotRef: { current: null } as any,
        vscodeApi: { postMessage },
        openRenameCommand,
      });
      useEffect(() => {
        api.doSaveFrom(commands);
      }, []);
      return <div />;
    }

    await TestUtils.act(async () => {
      ReactDOM.render(<Harness />, host);
      await tick();
    });

    expect(toast.show).toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();

    ReactDOM.unmountComponentAtNode(host);
    host.remove();
  });

  test('useSaveFlow：当前规则为空时不允许保存（即使存在其他非空规则）', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const postMessage = vi.fn();
    const toast = { show: vi.fn() };
    const setSelectedRuleIndex = vi.fn();

    const commands: ReplaceCommand[] = [
      {
        id: 'c1',
        title: 'C',
        rules: [
          { engine: 'regex', find: '', replace: '', flags: 'g' } as any,
          { engine: 'regex', find: 'a', replace: 'b', flags: 'g' } as any,
        ],
      } as any,
    ];

    function Harness(): React.ReactElement {
      const api = useSaveFlow({
        lang: 'en' as any,
        t: {
          nameRequired: 'required',
          nameDuplicate: 'duplicate',
          nameReservedChars: 'reserved',
          ruleTitleReservedChars: 'ruleReserved',
          ruleLabel: 'Rule',
          addRuleFirst: 'addRuleFirst',
          confirm: 'ok',
          cancel: 'cancel',
        },
        toast,
        commands,
        setCommands: () => {},
        setDirty: () => {},
        selectedId: 'c1',
        selectedIdRef: { current: 'c1' } as any,
        selectedRuleIndex: 0,
        setSelectedRuleIndex,
        commandsRef: { current: commands } as any,
        savedSnapshotRef: { current: null } as any,
        vscodeApi: { postMessage },
        openRenameCommand: async () => {},
      });
      useEffect(() => {
        api.doSaveFrom(commands);
      }, []);
      return <div />;
    }

    await TestUtils.act(async () => {
      ReactDOM.render(<Harness />, host);
      await tick();
    });

    expect(toast.show).toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
    expect(setSelectedRuleIndex).not.toHaveBeenCalled();

    ReactDOM.unmountComponentAtNode(host);
    host.remove();
  });

  test('useSaveFlow：存在空白草稿时保存仍保留侧栏空白未命名并将 ruleIndex 归零', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const postMessage = vi.fn();
    const toast = { show: vi.fn() };
    const setCommands = vi.fn();
    const setSelectedRuleIndex = vi.fn();
    const setDirty = vi.fn();

    const draft = createDraftCommand('Untitled command');
    const real: ReplaceCommand = { id: 'c1', title: 'C', rules: [{ engine: 'regex', find: 'a', replace: 'b', flags: 'g' } as any] } as any;
    const list: ReplaceCommand[] = [draft, real];

    const commandsRef = { current: list };

    function Harness(): React.ReactElement {
      const api = useSaveFlow({
        lang: 'en' as any,
        t: {
          nameRequired: 'required',
          nameDuplicate: 'duplicate',
          nameReservedChars: 'reserved',
          ruleTitleReservedChars: 'ruleReserved',
          ruleLabel: 'Rule',
          addRuleFirst: 'addRuleFirst',
          confirm: 'ok',
          cancel: 'cancel',
        },
        toast,
        commands: list,
        setCommands,
        setDirty,
        selectedId: 'c1',
        selectedIdRef: { current: 'c1' } as any,
        selectedRuleIndex: 0,
        setSelectedRuleIndex,
        commandsRef: commandsRef as any,
        savedSnapshotRef: { current: null } as any,
        vscodeApi: { postMessage },
        openRenameCommand: async () => {},
      });
      useEffect(() => {
        api.doSaveFrom(list);
      }, []);
      return <div />;
    }

    await TestUtils.act(async () => {
      ReactDOM.render(<Harness />, host);
      await tick();
    });

    expect(postMessage).toHaveBeenCalled();
    expect(setDirty).toHaveBeenCalledWith(false);
    expect(setCommands).toHaveBeenCalled();
    const merged = setCommands.mock.calls.at(-1)?.[0] as ReplaceCommand[] | undefined;
    expect(merged?.some((c) => c.id === draft.id)).toBe(true);
    expect(merged?.some((c) => c.id === 'c1')).toBe(true);
    expect(setSelectedRuleIndex).toHaveBeenCalledWith(0);

    ReactDOM.unmountComponentAtNode(host);
    host.remove();
  });

  test('useSaveFlow：requestSaveFrom 仅校验选中命令，其他命令名含保留字符仍落盘', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const openRenameCommand = vi.fn(async () => {});
    const postMessage = vi.fn();
    const toast = { show: vi.fn() };

    const list: ReplaceCommand[] = [
      { id: 'good', title: 'Demo', rules: [{ engine: 'regex', find: '\\d+', replace: 'x', flags: 'g' } as any] } as any,
      { id: 'other', title: 'Bad[name]', rules: [{ engine: 'regex', find: 'a', replace: 'b', flags: 'g' } as any] } as any,
    ];

    function Harness(): React.ReactElement {
      const api = useSaveFlow({
        lang: 'zh-CN' as any,
        t: {
          nameRequired: 'required',
          nameDuplicate: 'duplicate',
          nameReservedChars: 'reserved',
          ruleTitleReservedChars: 'ruleReserved',
          ruleLabel: '规则',
          addRuleFirst: 'addRuleFirst',
          confirm: 'ok',
          cancel: 'cancel',
        },
        toast,
        commands: list,
        setCommands: () => {},
        setDirty: () => {},
        selectedId: 'good',
        selectedIdRef: { current: 'good' } as any,
        selectedRuleIndex: 0,
        setSelectedRuleIndex: () => {},
        commandsRef: { current: list } as any,
        savedSnapshotRef: { current: null } as any,
        vscodeApi: { postMessage },
        openRenameCommand,
      });
      useEffect(() => {
        api.requestSaveFrom(list);
      }, []);
      return <div />;
    }

    await TestUtils.act(async () => {
      ReactDOM.render(<Harness />, host);
      await tick();
    });

    expect(toast.show).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalled();

    ReactDOM.unmountComponentAtNode(host);
    host.remove();
  });

  test('useSaveFlow：遇到未命名命令会触发 openRenameCommand，而不是直接保存', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const openRenameCommand = vi.fn(async () => {});
    const postMessage = vi.fn();
    const toast = { show: vi.fn() };

    const commands: ReplaceCommand[] = [{ id: 'u1', title: 'Untitled command', rules: [{ engine: 'regex', find: 'a', replace: 'b', flags: 'g' } as any] } as any];

    function Harness(): React.ReactElement {
      const api = useSaveFlow({
        lang: 'en' as any,
        t: {
          nameRequired: 'required',
          nameDuplicate: 'duplicate',
          nameReservedChars: 'reserved',
          ruleTitleReservedChars: 'ruleReserved',
          ruleLabel: 'Rule',
          addRuleFirst: 'addRuleFirst',
          confirm: 'ok',
          cancel: 'cancel',
        },
        toast,
        commands,
        setCommands: () => {},
        setDirty: () => {},
        selectedId: 'u1',
        selectedIdRef: { current: 'u1' } as any,
        selectedRuleIndex: 0,
        setSelectedRuleIndex: () => {},
        commandsRef: { current: commands } as any,
        savedSnapshotRef: { current: null } as any,
        vscodeApi: { postMessage },
        openRenameCommand,
      });
      useEffect(() => {
        api.requestSaveFrom(commands);
      }, []);
      return <div />;
    }

    await TestUtils.act(async () => {
      ReactDOM.render(<Harness />, host);
      await tick();
    });
    expect(openRenameCommand).toHaveBeenCalledWith('u1', '', true);
    expect(postMessage).not.toHaveBeenCalled();

    ReactDOM.unmountComponentAtNode(host);
    host.remove();
  });
});

