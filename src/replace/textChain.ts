import type { ReplaceCommand, ReplaceRule } from '../types';
import { applyRule } from './engines';

/**
 * hook 执行过程中检测到命令链死循环时抛出的错误。
 */
export class HookLoopError extends Error {
  chain: string[];

  /**
   * 创建死循环错误。
   *
   * @param message 错误信息。
   * @param chain 循环链路（命令 id 列表）。
   */
  constructor(message: string, chain: string[]) {
    super(message);
    this.name = 'HookLoopError';
    this.chain = chain;
  }
}

export type ApplyCommandResult = {
  text: string;
  totalReplacedCount: number;
  perRuleCounts: number[];
};

export type ApplyCommandOptions = {
  /** 最大执行到的规则索引（包含）；未传表示执行完整命令。 */
  maxRuleIndexInclusive?: number;
};

/**
 * 从规则中读取 hook ids（仅规则级：preCommands/postCommands）。
 *
 * @param _cmd 当前命令（保留参数用于调用点一致性与未来扩展）。
 * @param rule 当前规则。
 * @param phase 阶段：pre/post。
 * @returns hook id 列表。
 */
export function getHookIdsForRule(_cmd: ReplaceCommand, rule: ReplaceRule, phase: 'pre' | 'post'): string[] {
  const ids = phase === 'pre' ? (rule as any).preCommands : (rule as any).postCommands;
  return Array.isArray(ids) ? (ids as string[]) : [];
}

/**
 * 对一段文本按命令的规则链执行替换（不执行 hooks）。
 *
 * @param input 输入文本。
 * @param cmd 替换命令（包含多条规则）。
 * @param options 执行选项。
 * @returns 应用结果，包含替换后文本与统计信息。
 */
export function applyCommandToText(input: string, cmd: ReplaceCommand, options: ApplyCommandOptions = {}): ApplyCommandResult {
  let text = input;
  let totalReplacedCount = 0;
  const perRuleCounts: number[] = [];

  const maxIdx =
    typeof options.maxRuleIndexInclusive === 'number' ? Math.max(-1, Math.floor(options.maxRuleIndexInclusive)) : cmd.rules.length - 1;

  for (let i = 0; i < cmd.rules.length; i += 1) {
    if (i > maxIdx) break;
    const rule = cmd.rules[i];
    const res = applyRule(text, normalizeRule(rule));
    text = res.text;
    totalReplacedCount += res.replacedCount;
    perRuleCounts.push(res.replacedCount);
  }

  return { text, totalReplacedCount, perRuleCounts };
}

export type RunHookChainOnTextOptions = {
  /** 当 hookId 不命中已配置命令 id 时是否忽略（Webview 预览使用 true）。 */
  ignoreUnknownHookId: boolean;
  /** 最大递归深度（防止异常数据导致栈过深）。 */
  maxDepth: number;
};

/**
 * 在一段文本上执行“hook 命令链”：hookId 命中已配置命令 id 时按命令执行；否则可选择忽略。
 *
 * @param input 输入文本。
 * @param hookIds hook id 列表。
 * @param allCommands 所有命令（用于根据 id 查找）。
 * @param options 执行选项。
 * @returns 执行后的文本。
 */
export function runHookChainOnText(
  input: string,
  hookIds: string[],
  allCommands: ReplaceCommand[],
  options: RunHookChainOnTextOptions,
): string {
  return runHookChainOnTextInner(input, hookIds, allCommands, options, [], 0);
}

function runHookChainOnTextInner(
  input: string,
  hookIds: string[],
  allCommands: ReplaceCommand[],
  options: RunHookChainOnTextOptions,
  stack: string[],
  depth: number,
): string {
  let text = input;
  const ids = Array.isArray(hookIds) ? hookIds : [];
  for (const id of ids) {
    if (!id || typeof id !== 'string') continue;
    text = runHookEntryOnText(text, id, allCommands, options, stack, depth);
  }
  return text;
}

function runHookEntryOnText(
  input: string,
  hookId: string,
  allCommands: ReplaceCommand[],
  options: RunHookChainOnTextOptions,
  stack: string[],
  depth: number,
): string {
  if (depth > options.maxDepth) return input;
  const hookCmd = allCommands.find((c) => c.id === hookId);
  if (!hookCmd) {
    return options.ignoreUnknownHookId ? input : input;
  }

  if (stack.includes(hookId)) {
    const chain = [...stack, hookId];
    const msg = `检测到命令链死循环，已中止执行：${chain.join(' -> ')}`;
    throw new HookLoopError(msg, chain);
  }

  stack.push(hookId);
  try {
    // 执行该 hook 命令的所有规则，并在每条规则周围执行规则级 hooks（与扩展端一致）
    for (const rule of hookCmd.rules) {
      input = runHookChainOnTextInner(input, getHookIdsForRule(hookCmd, rule, 'pre'), allCommands, options, stack, depth + 1);
      input = applyRule(input, normalizeRule(rule)).text;
      input = runHookChainOnTextInner(input, getHookIdsForRule(hookCmd, rule, 'post'), allCommands, options, stack, depth + 1);
    }
    return input;
  } finally {
    stack.pop();
  }
}

/**
 * 规范化 rule：保证 find/replace/flags 的默认值存在，避免运行时异常。
 *
 * @param rule 规则对象。
 * @returns 规范化后的规则。
 */
function normalizeRule(rule: ReplaceRule): ReplaceRule {
  const next: ReplaceRule = {
    ...rule,
    find: (rule.find ?? '').toString(),
    replace: (rule.replace ?? '').toString(),
    flags: (rule.flags ?? 'g').toString(),
  };
  return next;
}

