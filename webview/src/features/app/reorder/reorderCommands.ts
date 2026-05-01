import type { ReplaceCommand } from '../../../../../../src/types';

/**
 * 根据目标 id 顺序重排命令列表，并保留未包含的项追加到末尾（避免草稿/异常数据丢失）。
 *
 * @param prev 旧命令列表。
 * @param nextCmdIds 新的命令 id 顺序。
 * @returns 重排后的命令列表；若输入不合法则返回原列表。
 */
export function computeReorderedCommands(prev: ReplaceCommand[], nextCmdIds: string[]): ReplaceCommand[] {
  const ids = Array.isArray(nextCmdIds) ? nextCmdIds.map((x) => String(x)) : [];
  if (ids.length <= 1) return prev;

  const map = new Map<string, ReplaceCommand>();
  for (const c of prev) map.set(c.id, c);

  const next: ReplaceCommand[] = [];
  for (const id of ids) {
    const cmd = map.get(id);
    if (cmd) next.push(cmd);
  }

  for (const c of prev) {
    if (!ids.includes(c.id)) next.push(c);
  }

  return next.length === prev.length ? next : prev;
}

/**
 * 基于“已保存快照”生成仅包含“顺序变更”的落盘 payload，避免把当前激活命令的未保存内容一起保存。
 *
 * @param snapshot 已保存快照。
 * @param nextCmdIds 新的命令 id 顺序。
 * @returns payload；若无法生成（例如 ids 与快照不匹配）则返回 null。
 */
export function computeReorderPayloadFromSnapshot(snapshot: ReplaceCommand[], nextCmdIds: string[]): ReplaceCommand[] | null {
  const ids = Array.isArray(nextCmdIds) ? nextCmdIds.map((x) => String(x)) : [];
  if (ids.length <= 1) return null;
  if (!snapshot || snapshot.length === 0) return null;

  const mapSnap = new Map<string, ReplaceCommand>();
  for (const c of snapshot) mapSnap.set(c.id, c);

  const payload: ReplaceCommand[] = [];
  for (const id of ids) {
    const cmd = mapSnap.get(id);
    if (cmd) payload.push(cmd);
  }
  for (const c of snapshot) {
    if (!ids.includes(c.id)) payload.push(c);
  }

  if (payload.length !== snapshot.length) return null;
  return payload;
}

