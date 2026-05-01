import * as vscode from 'vscode';
import type { ReplaceCommand } from './types';

/**
 * 读取用户配置的替换命令列表。
 *
 * @param target 配置读取目标；传入 `undefined` 表示读取合并后的有效值。
 * @returns 替换命令数组；若未配置则返回空数组。
 */
export function getConfiguredCommands(target?: vscode.ConfigurationTarget): ReplaceCommand[] {
  const cfg = vscode.workspace.getConfiguration('regexpReplacer');
  const value = target === undefined ? cfg.get<ReplaceCommand[]>('commands') : cfg.get<ReplaceCommand[]>('commands', []);
  return Array.isArray(value) ? value : [];
}

/**
 * 将替换命令列表写入 VS Code Settings。
 *
 * @param commands 要保存的命令列表。
 * @param target 写入目标（工作区或全局）。
 * @returns 保存完成的 Promise。
 */
export async function setConfiguredCommands(
  commands: ReplaceCommand[],
  target: vscode.ConfigurationTarget,
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('regexpReplacer');
  await cfg.update('commands', commands, target === vscode.ConfigurationTarget.Global);
}

/**
 * 清空指定目标的替换命令配置（移除对应 Settings 键）。
 *
 * @param target 清空目标（工作区或全局）。
 * @returns 清空完成的 Promise。
 */
export async function clearConfiguredCommands(target: vscode.ConfigurationTarget): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('regexpReplacer');
  await cfg.update('commands', undefined, target === vscode.ConfigurationTarget.Global);
}

