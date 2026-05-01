import { isUntitledCommandTitle } from '../../utils';

export type SaveRuleLike = {
  find: string;
  preCommands?: string[];
  postCommands?: string[];
  replaceMode?: 'template' | 'map';
  map?: unknown;
};

/**
 * 判断一条规则是否“可落盘”：表达式非空，或作为“命令编排规则”仅配置了前/后置命令。
 *
 * @param rule 规则对象（结构化子集）。
 * @returns 是否可保存。
 */
export function isSavableRule(rule: SaveRuleLike): boolean {
  const hasFind = (rule.find ?? '').trim() !== '';
  if (hasFind) return true;
  const hasPre = Array.isArray(rule.preCommands) && rule.preCommands.length > 0;
  const hasPost = Array.isArray(rule.postCommands) && rule.postCommands.length > 0;
  return hasPre || hasPost;
}

/**
 * 查找第一个“未命名命令”，用于保存前强制命名。
 *
 * @param list 命令列表。
 * @param isPristineUntitledDraft 判断是否为“空白未命名草稿”的函数（用于排除草稿）。
 * @returns 未命名命令（若存在），否则返回 undefined。
 */
export function findFirstUntitledCommand<T extends { title: string }>(
  list: T[],
  isPristineUntitledDraft?: (cmd: T) => boolean,
): T | undefined {
  return list.find((c) => isUntitledCommandTitle(c.title) && !(isPristineUntitledDraft?.(c) ?? false));
}

/**
 * 从命令列表构造可落盘的 payload（会剔除“空白未命名草稿”，并过滤空表达式规则）。
 *
 * @param list 命令列表。
 * @param isPristineUntitledDraft 判断是否为“空白未命名草稿”的函数。
 * @returns 用于写入配置的命令列表。
 */
export function buildPayloadFromList<T extends { rules: SaveRuleLike[] }>(
  list: T[],
  isPristineUntitledDraft: (cmd: T) => boolean,
): T[] {
  return list
    .filter((c) => !isPristineUntitledDraft(c))
    .map((cmd) => ({
      ...cmd,
      rules: cmd.rules
        .filter((r) => isSavableRule(r))
        .map((r) => normalizeRuleForSave(r)),
    }))
    .filter((cmd) => (cmd.rules?.length ?? 0) > 0);
}

/**
 * 将规则对象归一化为“更干净”的可落盘形态：剔除缺省字段，避免污染 settings payload。
 *
 * @param rule 规则对象。
 * @returns 归一化后的规则对象（浅拷贝）。
 */
function normalizeRuleForSave<T extends SaveRuleLike>(rule: T): T {
  const out = { ...rule } as any;
  const mode = (out.replaceMode ?? 'template') as 'template' | 'map';

  // testText 属于可选持久化字段：仅允许字符串；否则剔除，避免污染 settings payload。
  if ('testText' in out && typeof out.testText !== 'string') delete out.testText;

  // replaceMode 是缺省项（默认 template）：落盘时去掉，保持 payload 精简。
  if (mode === 'template') delete out.replaceMode;

  // 仅当 replaceMode=map 时 map 才有意义；否则剔除，避免无效配置触发 schema/校验问题。
  if (mode !== 'map') delete out.map;

  return out as T;
}

/**
 * 校验命令名称是否合法（非空、且不与现有命令重名）。
 *
 * @param allCommands 全部命令列表。
 * @param name 待校验的命令名称。
 * @param selfId 当前正在重命名的命令 id（用于排除自身）。
 * @returns 错误提示文本；若为 undefined 表示校验通过。
 */
export function validateCommandName<T extends { id: string; title: string }>(
  allCommands: T[],
  name: string,
  selfId: string,
  messages: { nameRequired: string; nameDuplicate: string; nameReservedChars: string },
): string | undefined {
  const v = name.trim();
  if (!v) return messages.nameRequired;
  if (hasReservedNameChars(v)) return messages.nameReservedChars;
  const lower = v.toLowerCase();
  const dup = allCommands.some((c) => c.id !== selfId && c.title.trim().toLowerCase() === lower);
  if (dup) return messages.nameDuplicate;
  return undefined;
}

/**
 * 校验规则标题是否合法（允许为空；非空时禁止包含保留字符 <>[]）。
 *
 * @param title 规则标题。
 * @param message 校验失败的提示文案。
 * @returns 错误提示；若为 undefined 表示校验通过。
 */
export function validateRuleTitle(title: string, message: string): string | undefined {
  const v = String(title ?? '').trim();
  if (!v) return undefined;
  if (hasReservedNameChars(v)) return message;
  return undefined;
}

/**
 * 判断名称中是否包含保留字符（未来用于特殊语义）：<>[]
 *
 * @param name 名称文本（已 trim）。
 * @returns 是否包含保留字符。
 */
function hasReservedNameChars(name: string): boolean {
  return /[<>[\]]/.test(name);
}

