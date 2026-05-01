export type HookPhase = 'pre' | 'post';

export type HookRuleLike = {
  preCommands?: string[];
  postCommands?: string[];
};

export type HookCommandLike = {
  id: string;
  title: string;
  rules?: HookRuleLike[];
};

/**
 * 获取某条规则的 hook 列表（仅规则级：preCommands/postCommands）。
 *
 * @param cmd 当前命令。
 * @param ruleIndex 规则索引。
 * @param phase 阶段：pre/post。
 * @returns hook id 列表。
 */
export function getSelectedRuleHooks(cmd: HookCommandLike, ruleIndex: number, phase: HookPhase): string[] {
  const rule = cmd.rules?.[ruleIndex];
  const fromRule = phase === 'pre' ? rule?.preCommands : rule?.postCommands;
  return Array.isArray(fromRule) ? fromRule : [];
}

/**
 * 判断给当前命令新增一条 hook 边（current -> target）是否会形成环。
 *
 * @param savedCommands 已保存命令列表（不含草稿）。
 * @param currentId 当前命令 id。
 * @param targetId 目标命令 id。
 * @returns 是否会形成环。
 */
export function wouldCreateLoop(savedCommands: HookCommandLike[], currentId: string, targetId: string): boolean {
  if (!currentId || !targetId) return false;
  if (currentId === targetId) return true;
  const idSet = new Set(savedCommands.map((c) => c.id));
  const adj = new Map<string, string[]>();
  for (const c of savedCommands) {
    const ruleOuts = (c.rules ?? []).flatMap((r) => [...(r.preCommands ?? []), ...(r.postCommands ?? [])]);
    const outs = [...ruleOuts].filter((x) => idSet.has(x));
    adj.set(c.id, outs);
  }
  // 假设新增 current -> target
  const stack = [targetId];
  const seen = new Set<string>();
  while (stack.length) {
    const x = stack.pop() as string;
    if (x === currentId) return true;
    if (seen.has(x)) continue;
    seen.add(x);
    const next = adj.get(x) ?? [];
    for (const n of next) stack.push(n);
  }
  return false;
}

export type HookOption = { id: string; title: string; disabled: boolean };

/**
 * 获取 hook 下拉选项（排除自身、并提供环检测禁用）。
 *
 * @param savedCommands 已保存命令列表（不含草稿）。
 * @param currentId 当前命令 id。
 * @returns 选项数组。
 */
export function getHookOptions(savedCommands: HookCommandLike[], currentId: string): HookOption[] {
  return savedCommands
    .filter((c) => c.id !== currentId)
    .map((c) => ({ id: c.id, title: c.title, disabled: currentId ? wouldCreateLoop(savedCommands, currentId, c.id) : false }));
}

