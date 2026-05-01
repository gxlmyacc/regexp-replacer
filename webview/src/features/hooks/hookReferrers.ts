import type { ReplaceCommand, ReplaceRule } from '../../../../src/types';

/**
 * 记录某条规则在前置/后置命令列表中引用了指定 hook 命令 id。
 */
export type HookReferrerEntry = {
  /** 引用方命令 id。 */
  sourceCommandId: string;
  /** 引用方命令标题。 */
  sourceTitle: string;
  /** 规则索引（从 0 开始）。 */
  ruleIndex: number;
  /** 规则标题（可选）。 */
  ruleTitle?: string;
  /** 引用发生在前置或后置。 */
  phase: 'pre' | 'post';
};

/**
 * 弹窗中按命令分组的展示块。
 */
export type HookReferrerBlock = {
  /** 命令标题。 */
  commandTitle: string;
  /** 命令 id。 */
  commandId: string;
  /** 人类可读的多行说明（每条规则一条）。 */
  items: string[];
};

/**
 * 弹窗中单条可勾选引用行：携带结构化 entry 与展示文案。
 */
export type HookReferrerRow = {
  /** 稳定 key（命令 id + 规则索引 + 阶段）。 */
  key: string;
  /** 引用条目。 */
  entry: HookReferrerEntry;
  /** 人类可读的一行说明。 */
  label: string;
};

/**
 * 为引用条目生成稳定 key，用于 UI 勾选状态与去重。
 *
 * @param e 引用条目。
 * @returns key 字符串。
 */
export function hookReferrerEntryKey(e: HookReferrerEntry): string {
  return `${e.sourceCommandId}\t${e.ruleIndex}\t${e.phase}`;
}

/**
 * 将单条引用格式化为弹窗列表用的一行文案。
 *
 * @param e 引用条目。
 * @param ruleLabelFn 生成「规则 n」标签，入参为 1-based 规则序号。
 * @param phasePreLabel 前置阶段文案。
 * @param phasePostLabel 后置阶段文案。
 * @returns 一行展示文本。
 */
export function formatHookReferrerLine(
  e: HookReferrerEntry,
  ruleLabelFn: (ruleOneBased: number) => string,
  phasePreLabel: string,
  phasePostLabel: string,
): string {
  const phaseLabel = e.phase === 'pre' ? phasePreLabel : phasePostLabel;
  const rulePart = `${ruleLabelFn(e.ruleIndex + 1)}${e.ruleTitle ? ` (${e.ruleTitle})` : ''}`;
  return `${rulePart} · ${phaseLabel}`;
}

/**
 * 将 collectHookReferrerEntries 的结果转为带 key 的弹窗行列表。
 *
 * @param entries 引用条目列表。
 * @param ruleLabelFn 规则序号标签函数。
 * @param phasePreLabel 前置文案。
 * @param phasePostLabel 后置文案。
 * @returns 行列表。
 */
export function buildHookReferrerRows(
  entries: HookReferrerEntry[],
  ruleLabelFn: (ruleOneBased: number) => string,
  phasePreLabel: string,
  phasePostLabel: string,
): HookReferrerRow[] {
  return entries.map((entry) => ({
    key: hookReferrerEntryKey(entry),
    entry,
    label: formatHookReferrerLine(entry, ruleLabelFn, phasePreLabel, phasePostLabel),
  }));
}

/**
 * 扫描全部命令，找出在任意规则的 preCommands/postCommands 中引用指定 hook 命令 id 的位置。
 *
 * @param commands 全部替换命令。
 * @param hookCommandId 被作为前置/后置引用的命令 id。
 * @returns 引用条目列表（不包含「自身命令」内的引用展示需求时仍可包含自引用，此处排除 hook 命令自身条目以避免噪声）。
 */
export function collectHookReferrerEntries(commands: ReplaceCommand[], hookCommandId: string): HookReferrerEntry[] {
  const out: HookReferrerEntry[] = [];
  if (!hookCommandId) return out;

  for (const cmd of commands) {
    const rules: ReplaceRule[] = Array.isArray(cmd.rules) ? cmd.rules : [];
    rules.forEach((rule, ruleIndex) => {
      const pre = Array.isArray(rule.preCommands) ? rule.preCommands : [];
      const post = Array.isArray(rule.postCommands) ? rule.postCommands : [];
      if (pre.includes(hookCommandId)) {
        out.push({
          sourceCommandId: cmd.id,
          sourceTitle: cmd.title ?? '',
          ruleIndex,
          ruleTitle: rule.title,
          phase: 'pre',
        });
      }
      if (post.includes(hookCommandId)) {
        out.push({
          sourceCommandId: cmd.id,
          sourceTitle: cmd.title ?? '',
          ruleIndex,
          ruleTitle: rule.title,
          phase: 'post',
        });
      }
    });
  }

  return out;
}

/**
 * 将引用条目分组为弹窗展示用的块状结构。
 *
 * @param entries collectHookReferrerEntries 的结果。
 * @param ruleLabelFn 生成「规则 n」标签的函数，入参为 1-based 规则序号。
 * @param phasePreLabel 前置阶段文案。
 * @param phasePostLabel 后置阶段文案。
 * @returns 分组后的块列表。
 */
export function groupHookReferrerEntriesForModal(
  entries: HookReferrerEntry[],
  ruleLabelFn: (ruleOneBased: number) => string,
  phasePreLabel: string,
  phasePostLabel: string,
): HookReferrerBlock[] {
  const map = new Map<string, HookReferrerBlock>();

  for (const e of entries) {
    const phaseLabel = e.phase === 'pre' ? phasePreLabel : phasePostLabel;
    const rulePart = `${ruleLabelFn(e.ruleIndex + 1)}${e.ruleTitle ? ` (${e.ruleTitle})` : ''}`;
    const line = `${rulePart} · ${phaseLabel}`;
    const prev = map.get(e.sourceCommandId);
    if (!prev) {
      map.set(e.sourceCommandId, {
        commandTitle: e.sourceTitle || e.sourceCommandId,
        commandId: e.sourceCommandId,
        items: [line],
      });
    } else {
      prev.items.push(line);
    }
  }

  return Array.from(map.values());
}

/**
 * 从所有规则的 preCommands/postCommands 中移除指定的 hook 命令 id。
 *
 * @param commands 命令列表。
 * @param hookCommandId 要移除的命令 id。
 * @returns 新列表（浅拷贝规则对象）。
 */
export function stripHookIdFromCommands(commands: ReplaceCommand[], hookCommandId: string): ReplaceCommand[] {
  if (!hookCommandId) return commands;

  return commands.map((cmd) => ({
    ...cmd,
    rules: (cmd.rules ?? []).map((rule) => ({
      ...rule,
      preCommands: (rule.preCommands ?? []).filter((id) => id !== hookCommandId),
      postCommands: (rule.postCommands ?? []).filter((id) => id !== hookCommandId),
    })),
  }));
}

/**
 * 仅在指定引用位置从规则的前置或后置列表中移除 hook 命令 id（其它位置保留）。
 *
 * @param commands 命令列表。
 * @param hookCommandId 被引用的命令 id。
 * @param entries 要移除引用的条目（通常为用户在弹窗中勾选的行）。
 * @returns 新列表（浅拷贝命令与规则对象）。
 */
export function stripHookIdFromReferrerEntries(
  commands: ReplaceCommand[],
  hookCommandId: string,
  entries: HookReferrerEntry[],
): ReplaceCommand[] {
  if (!hookCommandId || !entries.length) return commands;

  return commands.map((cmd) => {
    const touched = entries.filter((e) => e.sourceCommandId === cmd.id);
    if (touched.length === 0) return cmd;

    const rules = (cmd.rules ?? []).map((rule) => ({
      ...rule,
      preCommands: [...(rule.preCommands ?? [])],
      postCommands: [...(rule.postCommands ?? [])],
    }));

    for (const e of touched) {
      const rule = rules[e.ruleIndex];
      if (!rule) continue;
      if (e.phase === 'pre') {
        rule.preCommands = (rule.preCommands ?? []).filter((id) => id !== hookCommandId);
      } else {
        rule.postCommands = (rule.postCommands ?? []).filter((id) => id !== hookCommandId);
      }
    }
    return { ...cmd, rules };
  });
}
