import { describe, expect, test } from 'vitest';
import type { ReplaceCommand } from '../../src/types';
import { computeReorderPayloadFromSnapshot, computeReorderedCommands } from '../../webview/src/features/app/reorder/reorderCommands';

describe('reorderCommands', () => {
  test('computeReorderedCommands：按 ids 重排，并把未包含项追加到末尾', () => {
    const prev: ReplaceCommand[] = [
      { id: 'a', title: 'A', rules: [] as any },
      { id: 'b', title: 'B', rules: [] as any },
      { id: 'c', title: 'C', rules: [] as any },
    ];
    const next = computeReorderedCommands(prev, ['c', 'a']);
    expect(next.map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  test('computeReorderedCommands：输入不合法或长度不足时返回原数组', () => {
    const prev: ReplaceCommand[] = [{ id: 'a', title: 'A', rules: [] as any }];
    expect(computeReorderedCommands(prev, [])).toBe(prev);
    expect(computeReorderedCommands(prev, ['a'])).toBe(prev);
  });

  test('computeReorderPayloadFromSnapshot：基于快照重排，只返回快照里的对象引用', () => {
    const snap: ReplaceCommand[] = [
      { id: 'a', title: 'A', rules: [] as any },
      { id: 'b', title: 'B', rules: [] as any },
      { id: 'c', title: 'C', rules: [] as any },
    ];
    const payload = computeReorderPayloadFromSnapshot(snap, ['c', 'a', 'b']);
    expect(payload?.map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(payload?.[0]).toBe(snap[2]);
  });

  test('computeReorderPayloadFromSnapshot：ids 与快照不匹配时返回 null', () => {
    const snap: ReplaceCommand[] = [
      { id: 'a', title: 'A', rules: [] as any },
      { id: 'b', title: 'B', rules: [] as any },
    ];
    expect(computeReorderPayloadFromSnapshot(snap, ['b'])).toBeNull();
    expect(computeReorderPayloadFromSnapshot(snap, ['b', 'missing'])?.map((x) => x.id)).toEqual(['b', 'a']);
  });
});

