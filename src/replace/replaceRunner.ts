import * as vscode from 'vscode';
import type { ReplaceCommand, ReplaceRule } from '../types';
import { applyRule } from './engines';
import { HookLoopError, getHookIdsForRule } from './textChain';

export { HookLoopError } from './textChain';

// HookLoopError 已抽离至 src/replace/textChain.ts（供 Webview/扩展复用）

export interface ApplyCommandResult {
  text: string;
  totalReplacedCount: number;
  perRuleCounts: number[];
}

/**
 * 对一段文本按命令的规则链执行替换。
 *
 * @param input 输入文本。
 * @param cmd 替换命令（包含多条规则）。
 * @returns 应用结果，包含替换后文本与统计信息。
 */
export function applyCommandToText(input: string, cmd: ReplaceCommand): ApplyCommandResult {
  let text = input;
  let totalReplacedCount = 0;
  const perRuleCounts: number[] = [];

  for (const rule of cmd.rules) {
    const res = applyRule(text, normalizeRule(rule));
    text = res.text;
    totalReplacedCount += res.replacedCount;
    perRuleCounts.push(res.replacedCount);
  }

  return { text, totalReplacedCount, perRuleCounts };
}

// getHookIdsForRule 已抽离至 src/replace/textChain.ts（供 Webview/扩展复用）

/**
 * 对全文应用单条规则并写回编辑器。
 *
 * @param editor 活动编辑器。
 * @param rule 替换规则。
 * @returns 替换次数。
 */
async function applyRuleToFile(editor: vscode.TextEditor, rule: ReplaceRule): Promise<number> {
  const doc = editor.document;
  const fullText = doc.getText();
  const res = applyRule(fullText, normalizeRule(rule));
  if (res.text === fullText) return res.replacedCount;
  const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(fullText.length));
  await editor.edit((eb) => {
    eb.replace(fullRange, res.text);
  });
  return res.replacedCount;
}

/**
 * 对当前选区应用单条规则并写回编辑器。
 *
 * @param editor 活动编辑器。
 * @param rule 替换规则。
 * @returns 替换次数。
 */
async function applyRuleToSelection(editor: vscode.TextEditor, rule: ReplaceRule): Promise<number> {
  const doc = editor.document;
  const selections = editor.selections.filter((s) => !s.isEmpty);
  let total = 0;

  const plans = selections.map((sel) => {
    const range = new vscode.Range(sel.start, sel.end);
    const text = doc.getText(range);
    const res = applyRule(text, normalizeRule(rule));
    total += res.replacedCount;
    return { range, text: res.text };
  });

  await editor.edit((eb) => {
    for (const p of plans) eb.replace(p.range, p.text);
  });

  return total;
}

/**
 * 将命令应用到当前文件全文，并写回编辑器（可撤销）。
 *
 * @param editor 活动编辑器。
 * @param cmd 选择的替换命令。
 * @returns 执行统计结果。
 */
export async function runReplaceInFile(
  editor: vscode.TextEditor,
  cmd: ReplaceCommand,
  allCommands?: ReplaceCommand[],
  stack?: string[],
): Promise<ApplyCommandResult> {
  const perRuleCounts: number[] = [];
  let totalReplacedCount = 0;

  // 若提供 allCommands，则按规则执行规则级 hooks（并兼容命令级 hooks）
  // 重要：当该命令是通过 preCommands/postCommands 触发的“命令链”执行时，按约定不受 enable 影响。
  // 这里用 stack 是否存在来区分：stack 仅在命令链递归执行时传入。
  const shouldRespectEnable = stack === undefined;

  for (let i = 0; i < cmd.rules.length; i += 1) {
    const rule = cmd.rules[i];
    if (shouldRespectEnable && rule.enable === false) {
      perRuleCounts.push(0);
      continue;
    }
    if (allCommands) {
      const chain = stack ?? [cmd.id];
      await runHookIds(editor, getHookIdsForRule(cmd, rule, 'pre'), allCommands, 'file', chain);
    }
    const c = await applyRuleToFile(editor, rule);
    perRuleCounts.push(c);
    totalReplacedCount += c;
    if (allCommands) {
      const chain = stack ?? [cmd.id];
      await runHookIds(editor, getHookIdsForRule(cmd, rule, 'post'), allCommands, 'file', chain);
    }
  }

  return { text: '', totalReplacedCount, perRuleCounts };
}

export interface CommandHook {
  phase: 'pre' | 'post';
  commandId: string;
  args?: unknown[];
}

export interface RunHooksOptions {
  hooks?: CommandHook[];
}

/**
 * 执行命令配置的前置/后置 VS Code 命令（commands.executeCommand）。
 *
 * @param cmd 替换命令配置。
 * @param phase 执行阶段：`pre` 或 `post`。
 * @returns 无返回值。
 */
/**
 * 执行命令配置的前置/后置命令。
 *
 * 兼容两种写法：
 * 1) 若 hookId 命中已配置命令 id：按“替换命令链”执行（并递归执行其 hooks）。
 * 2) 否则：按 VS Code command id 执行（commands.executeCommand）。
 *
 * @param editor 活动编辑器。
 * @param cmd 当前替换命令。
 * @param phase 阶段：pre/post。
 * @param allCommands 当前已配置的全部命令。
 * @param scope 作用范围：file/selection。
 * @param stack 当前调用栈（用于防止死循环）。
 * @returns 无返回值。
 */
// 命令级 hooks（cmd.preCommands/postCommands）已移除，仅保留规则级 hooks（rule.preCommands/postCommands）。

/**
 * 执行一组 hook ids（可能是替换命令 id，也可能是 VS Code command id）。
 *
 * @param editor 活动编辑器。
 * @param ids hook id 列表。
 * @param allCommands 所有替换命令。
 * @param scope 作用范围。
 * @param stack 调用栈（用于死循环检测）。
 * @returns 无返回值。
 */
async function runHookIds(
  editor: vscode.TextEditor,
  ids: string[],
  allCommands: ReplaceCommand[],
  scope: 'file' | 'selection',
  stack: string[],
): Promise<void> {
  for (const id of ids) {
    if (!id || typeof id !== 'string') continue;
    await runHookEntry(editor, id, allCommands, scope, stack);
  }
}

/**
 * 执行一条 hook entry（可能是替换命令 id，也可能是 VS Code command id）。
 *
 * @param editor 活动编辑器。
 * @param hookId hook id。
 * @param allCommands 所有替换命令。
 * @param scope 作用范围。
 * @param stack 调用栈。
 * @returns 无返回值。
 */
async function runHookEntry(
  editor: vscode.TextEditor,
  hookId: string,
  allCommands: ReplaceCommand[],
  scope: 'file' | 'selection',
  stack: string[],
): Promise<void> {
  const hookCmd = allCommands.find((c) => c.id === hookId);
  if (!hookCmd) {
    await vscode.commands.executeCommand(hookId);
    return;
  }

  if (stack.includes(hookId)) {
    const chain = [...stack, hookId];
    const msg = `检测到命令链死循环，已中止执行：${chain.join(' -> ')}`;
    throw new HookLoopError(msg, chain);
  }

  stack.push(hookId);
  try {
    if (scope === 'file') {
      await runReplaceInFile(editor, hookCmd, allCommands, stack);
    } else {
      await runReplaceInSelection(editor, hookCmd, allCommands, stack);
    }
  } finally {
    stack.pop();
  }
}

/**
 * 将命令应用到当前选区（支持多选区），并写回编辑器（可撤销）。
 *
 * @param editor 活动编辑器。
 * @param cmd 选择的替换命令。
 * @returns 执行统计结果（聚合所有选区）。
 */
export async function runReplaceInSelection(
  editor: vscode.TextEditor,
  cmd: ReplaceCommand,
  allCommands?: ReplaceCommand[],
  stack?: string[],
): Promise<ApplyCommandResult> {
  const perRuleCounts: number[] = [];
  let totalReplacedCount = 0;

  // 重要：当该命令是通过 preCommands/postCommands 触发的“命令链”执行时，按约定不受 enable 影响。
  // 这里用 stack 是否存在来区分：stack 仅在命令链递归执行时传入。
  const shouldRespectEnable = stack === undefined;

  for (let i = 0; i < cmd.rules.length; i += 1) {
    const rule = cmd.rules[i];
    if (shouldRespectEnable && rule.enable === false) {
      perRuleCounts.push(0);
      continue;
    }
    if (allCommands) {
      const chain = stack ?? [cmd.id];
      await runHookIds(editor, getHookIdsForRule(cmd, rule, 'pre'), allCommands, 'selection', chain);
    }
    const c = await applyRuleToSelection(editor, rule);
    perRuleCounts.push(c);
    totalReplacedCount += c;
    if (allCommands) {
      const chain = stack ?? [cmd.id];
      await runHookIds(editor, getHookIdsForRule(cmd, rule, 'post'), allCommands, 'selection', chain);
    }
  }

  return { text: '', totalReplacedCount, perRuleCounts };
}

/**
 * 规范化规则参数，避免常见配置导致异常或死循环。
 *
 * @param rule 原始规则。
 * @returns 规范化后的规则。
 */
function normalizeRule(rule: ReplaceRule): ReplaceRule {
  const next: ReplaceRule = {
    ...rule,
    find: (rule.find ?? '').toString(),
    replace: (rule.replace ?? '').toString(),
    flags: (rule.flags ?? 'g').toString(),
  };
  if (next.engine !== 'regex') return next;
  return { ...next, flags: normalizeRegexFlags(next.flags ?? 'g') };
}

/**
 * 清理并去重正则 flags，确保只保留 JS 支持的 flags。
 *
 * @param flags 用户配置的 flags。
 * @returns 规范化后的 flags 字符串。
 */
function normalizeRegexFlags(flags: string): string {
  const allowed = new Set(['g', 'i', 'm', 's', 'u', 'y', 'd']);
  const out: string[] = [];
  for (const ch of flags) {
    if (!allowed.has(ch)) continue;
    if (out.includes(ch)) continue;
    out.push(ch);
  }
  return out.join('') || 'g';
}

