import * as vscode from 'vscode';
import type { ReplaceCommand } from '../types';

/**
 * 弹出命令选择列表，让用户选择一个替换命令。
 *
 * @param commands 可选命令列表。
 * @returns 用户选中的命令；若用户取消则返回 `undefined`。
 */
export async function pickReplaceCommand(commands: ReplaceCommand[]): Promise<ReplaceCommand | undefined> {
  const visibleCommands = commands.filter((c) => c.rules.some((r) => r.enable !== false));

  const items: Array<vscode.QuickPickItem & { command: ReplaceCommand }> = visibleCommands.map((c) => ({
    label: c.title,
    description: c.id,
    detail: c.description,
    command: c,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    title: 'RegExp Replacer',
    placeHolder: '请选择要执行的替换命令',
    matchOnDescription: true,
    matchOnDetail: true,
  });

  return picked?.command;
}

