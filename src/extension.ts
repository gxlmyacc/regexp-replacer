import * as vscode from 'vscode';
import { getConfiguredCommands } from './config';
import { HookLoopError, runReplaceInFile, runReplaceInSelection } from './replace/replaceRunner';
import { registerPlacementIconUi } from './ui/placementIconUi';
import { pickReplaceCommand } from './ui/picker';
import { showNoCommandsMessage, showNoSelectionMessage } from './ui/messages';
import { RegExpUiPanel } from './webview/regExpUiPanel';

/**
 * 扩展激活入口。
 *
 * @param context VS Code 扩展上下文，用于注册命令与访问存储。
 * @returns 无返回值。
 */
export function activate(context: vscode.ExtensionContext): void {
  const disposables: vscode.Disposable[] = [];

  registerPlacementIconUi(context);

  disposables.push(
    vscode.commands.registerCommand('regexpReplacer.replaceInFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        await vscode.window.showInformationMessage('当前没有可用的编辑器。');
        return;
      }

      const commands = getConfiguredCommands();
      if (commands.length === 0) {
        await showNoCommandsMessage();
        return;
      }

      const picked = await pickReplaceCommand(commands);
      if (!picked) return;

      try {
        const res = await runReplaceInFile(editor, picked, commands);
        await vscode.window.showInformationMessage(`已执行：${picked.title}，替换次数：${res.totalReplacedCount}`);
      } catch (e) {
        if (e instanceof HookLoopError) {
          await vscode.window.showErrorMessage(e.message);
          return;
        }
        await vscode.window.showErrorMessage(`执行替换失败：${e instanceof Error ? e.message : String(e)}`);
      }
    }),
  );

  disposables.push(
    vscode.commands.registerCommand('regexpReplacer.replaceInSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        await vscode.window.showInformationMessage('当前没有可用的编辑器。');
        return;
      }

      const hasSelection = editor.selections.some((s) => !s.isEmpty);
      if (!hasSelection) {
        await showNoSelectionMessage();
        return;
      }

      const commands = getConfiguredCommands();
      if (commands.length === 0) {
        await showNoCommandsMessage();
        return;
      }

      const picked = await pickReplaceCommand(commands);
      if (!picked) return;

      try {
        const res = await runReplaceInSelection(editor, picked, commands);
        await vscode.window.showInformationMessage(`已执行：${picked.title}，替换次数：${res.totalReplacedCount}`);
      } catch (e) {
        if (e instanceof HookLoopError) {
          await vscode.window.showErrorMessage(e.message);
          return;
        }
        await vscode.window.showErrorMessage(`执行替换失败：${e instanceof Error ? e.message : String(e)}`);
      }
    }),
  );

  disposables.push(
    vscode.commands.registerCommand('regexpReplacer.openCommandManager', async () => {
      RegExpUiPanel.show(context);
    }),
  );

  disposables.push(
    vscode.commands.registerCommand('regexpReplacer.openRegExpUI', async () => {
      RegExpUiPanel.show(context);
    }),
  );

  context.subscriptions.push(...disposables);
}

/**
 * 扩展停用入口。
 *
 * @returns 无返回值。
 */
export function deactivate(): void {
  // 无需显式清理，VS Code 会处理 subscriptions。
}

