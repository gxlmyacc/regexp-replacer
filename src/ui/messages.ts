import * as vscode from 'vscode';

/**
 * 提示用户当前未配置任何替换命令，并提供打开管理界面的操作入口。
 *
 * @returns 无返回值。
 */
export async function showNoCommandsMessage(): Promise<void> {
  const open = '打开 RegExp UI';
  const res = await vscode.window.showWarningMessage('未配置任何替换命令。', open);
  if (res === open) {
    await vscode.commands.executeCommand('regexpReplacer.openRegExpUI');
  }
}

/**
 * 提示用户需要先选中一段文本才能执行“在选中文本中替换”。
 *
 * @returns 无返回值。
 */
export async function showNoSelectionMessage(): Promise<void> {
  await vscode.window.showInformationMessage('请先选中要替换的文本。');
}

