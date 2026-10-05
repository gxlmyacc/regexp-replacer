import { beforeEach, expect, test, vi } from 'vitest';
import * as vscode from 'vscode';
import { activate, deactivate } from '../../src/extension';
import { HookLoopError, runReplaceInFile, runReplaceInSelection } from '../../src/replace/replaceRunner';
import { RegExpUiPanel } from '../../src/webview/regExpUiPanel';
vi.mock('../../src/replace/replaceRunner', async (original) => ({ ...await original<any>(), runReplaceInFile: vi.fn(), runReplaceInSelection: vi.fn() }));
vi.mock('../../src/ui/placementIconUi', () => ({ registerPlacementIconUi: vi.fn() }));
vi.mock('../../src/webview/regExpUiPanel', () => ({ RegExpUiPanel: { show: vi.fn() } }));
const api = vscode as unknown as typeof import('./helpers/vscode');
const command = { id: 'one', title: 'One', rules: [{ engine: 'text', find: 'a', replace: 'b' }] };
let handlers: Record<string, () => Promise<void>>;

beforeEach(() => {
  vi.resetAllMocks();
  handlers = {};
  api.commands.registerCommand.mockImplementation((id, callback) => { handlers[id] = callback; return { dispose: vi.fn() }; });
  api.workspace.getConfiguration.mockReturnValue({ get: () => [command] });
  activate({ subscriptions: [] } as any);
});

test.each(['File', 'Selection'])('replaceIn%s handles editor absence, cancellation, empty configuration and errors', async (scope) => {
  const run = handlers[`regexpReplacer.replaceIn${scope}`];
  api.window.activeTextEditor = undefined;
  await run();
  expect(api.window.showInformationMessage).toHaveBeenCalledWith('当前没有可用的编辑器。');
  api.window.activeTextEditor = { selections: [{ isEmpty: true }] } as any;
  if (scope === 'Selection') {
    await run();
    expect(api.window.showInformationMessage).toHaveBeenCalledWith('请先选中要替换的文本。');
  }
  api.window.activeTextEditor = { selections: [{ isEmpty: false }] } as any;
  api.workspace.getConfiguration.mockReturnValue({ get: () => [] });
  await run();
  expect(api.window.showWarningMessage).toHaveBeenCalled();
  api.workspace.getConfiguration.mockReturnValue({ get: () => [command] });
  api.window.showQuickPick.mockResolvedValueOnce(undefined).mockResolvedValue({ command });
  await run();
  const replace = vi.mocked(scope === 'File' ? runReplaceInFile : runReplaceInSelection);
  expect(replace).not.toHaveBeenCalled();
  replace.mockResolvedValueOnce({ text: '', perRuleCounts: [2], totalReplacedCount: 2 });
  await run();
  expect(api.window.showInformationMessage).toHaveBeenCalledWith('已执行：One，替换次数：2');
  for (const error of [new HookLoopError('loop', ['one']), new Error('broken'), 'unexpected']) {
    replace.mockRejectedValueOnce(error);
    await run();
    expect(api.window.showErrorMessage).toHaveBeenLastCalledWith(error instanceof HookLoopError ? 'loop' : `执行替换失败：${error instanceof Error ? error.message : error}`);
  }
});

test('both UI aliases open the panel and deactivation is safe', async () => {
  await handlers['regexpReplacer.openCommandManager']();
  await handlers['regexpReplacer.openRegExpUI']();
  expect(RegExpUiPanel.show).toHaveBeenCalledTimes(2);
  expect(deactivate()).toBeUndefined();
});
