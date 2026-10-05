import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as vscode from 'vscode';
import { getConfiguredCommands, setConfiguredCommands, clearConfiguredCommands } from '../../src/config';
import { pickReplaceCommand } from '../../src/ui/picker';
import { showNoCommandsMessage, showNoSelectionMessage } from '../../src/ui/messages';
import { registerPlacementIconUi, showReplacerIconQuickPick } from '../../src/ui/placementIconUi';
import type { ReplaceCommand } from '../../src/types';

const api = vscode as unknown as typeof import('./helpers/vscode');
const command: ReplaceCommand = { id: 'one', title: 'One', rules: [{ engine: 'text', find: 'a', replace: 'b' }] };

beforeEach(() => { vi.resetAllMocks(); api.env.language = 'en'; });

describe('host configuration and menus', () => {
  test('configuration reads arrays and writes the selected global/workspace target', async () => {
    const get = vi.fn().mockReturnValueOnce([command]).mockReturnValueOnce(null).mockReturnValueOnce([command]);
    const update = vi.fn();
    api.workspace.getConfiguration.mockReturnValue({ get, update });
    expect(getConfiguredCommands()).toEqual([command]);
    expect(getConfiguredCommands()).toEqual([]);
    expect(getConfiguredCommands(vscode.ConfigurationTarget.Workspace)).toEqual([command]);
    for (const target of [vscode.ConfigurationTarget.Workspace, vscode.ConfigurationTarget.Global]) {
      await setConfiguredCommands([command], target);
      expect(update).toHaveBeenLastCalledWith('commands', [command], target === vscode.ConfigurationTarget.Global);
      await clearConfiguredCommands(target);
      expect(update).toHaveBeenLastCalledWith('commands', undefined, target === vscode.ConfigurationTarget.Global);
    }
  });
  test('picker hides disabled commands and returns cancellation or the selected command', async () => {
    const disabled = { ...command, id: 'disabled', rules: [{ ...command.rules[0], enable: false }] };
    api.window.showQuickPick.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ command });
    expect(await pickReplaceCommand([disabled, command])).toBeUndefined();
    expect(api.window.showQuickPick.mock.calls[0][0]).toEqual([expect.objectContaining({ command, label: 'One' })]);
    expect(await pickReplaceCommand([command])).toBe(command);
    api.window.showWarningMessage.mockResolvedValueOnce(undefined).mockResolvedValueOnce('打开 RegExp UI');
    await showNoCommandsMessage();
    expect(api.commands.executeCommand).not.toHaveBeenCalled();
    await showNoCommandsMessage();
    expect(api.commands.executeCommand).toHaveBeenCalledWith('regexpReplacer.openRegExpUI');
    await showNoSelectionMessage();
    expect(api.window.showInformationMessage).toHaveBeenCalledWith('请先选中要替换的文本。');
  });
  test.each(['en', 'zh-CN'])('localized status menu %s supports cancellation and execution', async (language) => {
    api.env.language = language;
    api.window.showQuickPick.mockResolvedValueOnce(undefined).mockImplementationOnce(async (items) => items[1]);
    await showReplacerIconQuickPick();
    expect(api.commands.executeCommand).not.toHaveBeenCalled();
    await showReplacerIconQuickPick();
    expect(api.commands.executeCommand).toHaveBeenCalledWith('regexpReplacer.replaceInSelection');
    expect(api.window.showQuickPick.mock.calls[0][0][0].label).toBe(language === 'en' ? 'Replace in File' : '在文件中替换');
  });
  test('status bar follows visibility, alignment, locale and relevant configuration changes', () => {
    let placement = 'statusBarLeft';
    let show = true;
    const get = vi.fn((key: string) => key.endsWith('iconPlacement') ? placement : show);
    api.workspace.getConfiguration.mockReturnValue({ get });
    api.window.createStatusBarItem.mockImplementation((_id, alignment) => ({ alignment, show: vi.fn(), dispose: vi.fn() }));
    const subscriptions: Array<{ dispose: () => void }> = [];
    registerPlacementIconUi({ subscriptions } as unknown as vscode.ExtensionContext);
    const change = api.workspace.onDidChangeConfiguration.mock.calls[0][0];
    const first = api.window.createStatusBarItem.mock.results[0].value;
    expect(first.command).toBe('regexpReplacer.showIconMenu');
    expect(first.show).toHaveBeenCalledOnce();
    change({ affectsConfiguration: () => false });
    expect(first.show).toHaveBeenCalledOnce();
    change({ affectsConfiguration: () => true });
    expect(api.window.createStatusBarItem).toHaveBeenCalledOnce();
    placement = 'statusBarRight';
    api.env.language = 'zh-CN';
    change({ affectsConfiguration: (key: string) => key.endsWith('iconPlacement') });
    expect(first.dispose).toHaveBeenCalledOnce();
    const second = api.window.createStatusBarItem.mock.results[1].value;
    expect(second.name).toBe('正则替换器');
    show = false;
    change({ affectsConfiguration: () => true });
    expect(second.dispose).toHaveBeenCalledOnce();
    placement = 'unknown'; show = true;
    change({ affectsConfiguration: () => true });
    expect(api.window.createStatusBarItem).toHaveBeenCalledTimes(2);
    placement = 'statusBarLeft';
    change({ affectsConfiguration: () => true });
    subscriptions.at(-1)!.dispose();
    subscriptions.at(-1)!.dispose();
    expect(api.window.createStatusBarItem.mock.results[2].value.dispose).toHaveBeenCalledOnce();
    const openMenu = api.commands.registerCommand.mock.calls[0][1];
    openMenu();
    expect(api.window.showQuickPick).toHaveBeenCalled();
  });
  test('chrome toolbar opens only the packaged UI page', async () => {
    const listeners: Array<() => Promise<void>> = [];
    const create = vi.fn();
    vi.stubGlobal('chrome', { action: { onClicked: { addListener: (listener: () => Promise<void>) => listeners.push(listener) } },
      runtime: { getURL: (path: string) => `chrome-extension://test/${path}` }, tabs: { create } });
    try {
      await import('../../chrome-extension/background.js');
      expect(listeners).toHaveLength(1);
      await listeners[0]();
      expect(create).toHaveBeenCalledWith({ url: 'chrome-extension://test/ui/index.html' });
    } finally { vi.unstubAllGlobals(); }
  });
});
