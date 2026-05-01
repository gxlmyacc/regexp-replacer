import { describe, expect, test } from 'vitest';
import {
  buildHookReferrerRows,
  collectHookReferrerEntries,
  groupHookReferrerEntriesForModal,
  stripHookIdFromCommands,
  stripHookIdFromReferrerEntries,
} from '../../webview/src/features/hooks/hookReferrers';
import type { ReplaceCommand } from '../../src/types';

describe('hookReferrers', () => {
  test('collectHookReferrerEntries：列出引用指定命令 id 的规则', () => {
    const commands: ReplaceCommand[] = [
      {
        id: 'hook',
        title: 'Hook',
        rules: [{ engine: 'text', find: 'a', replace: 'b', preCommands: [], postCommands: [] }],
      },
      {
        id: 'main',
        title: 'Main',
        rules: [
          {
            engine: 'text',
            find: 'x',
            replace: 'y',
            title: 'R1',
            preCommands: ['hook'],
            postCommands: [],
          },
        ],
      },
    ];
    const entries = collectHookReferrerEntries(commands, 'hook');
    expect(entries.length).toBe(1);
    expect(entries[0]?.sourceCommandId).toBe('main');
    expect(entries[0]?.phase).toBe('pre');
  });

  test('stripHookIdFromCommands：从所有规则前后置列表移除 id', () => {
    const commands: ReplaceCommand[] = [
      {
        id: 'main',
        title: 'Main',
        rules: [{ engine: 'text', find: 'x', replace: 'y', preCommands: ['hook'], postCommands: ['hook'] }],
      },
    ];
    const next = stripHookIdFromCommands(commands, 'hook');
    expect(next[0]?.rules[0]?.preCommands).toEqual([]);
    expect(next[0]?.rules[0]?.postCommands).toEqual([]);
  });

  test('stripHookIdFromReferrerEntries：仅移除指定条目对应的前/后置引用', () => {
    const commands: ReplaceCommand[] = [
      {
        id: 'main',
        title: 'Main',
        rules: [{ engine: 'text', find: 'x', replace: 'y', preCommands: ['hook', 'keep'], postCommands: ['hook'] }],
      },
    ];
    const next = stripHookIdFromReferrerEntries(commands, 'hook', [
      { sourceCommandId: 'main', sourceTitle: 'Main', ruleIndex: 0, phase: 'pre' },
    ]);
    expect(next[0]?.rules[0]?.preCommands).toEqual(['keep']);
    expect(next[0]?.rules[0]?.postCommands).toEqual(['hook']);
  });

  test('buildHookReferrerRows：生成带 key 的行', () => {
    const rows = buildHookReferrerRows(
      [{ sourceCommandId: 'm', sourceTitle: 'M', ruleIndex: 0, phase: 'pre' }],
      (n) => `R${n}`,
      'pre',
      'post',
    );
    expect(rows.length).toBe(1);
    expect(rows[0]?.key).toContain('m');
    expect(rows[0]?.label).toContain('R1');
  });

  test('groupHookReferrerEntriesForModal：按命令分组', () => {
    const blocks = groupHookReferrerEntriesForModal(
      [
        {
          sourceCommandId: 'm',
          sourceTitle: 'M',
          ruleIndex: 0,
          phase: 'pre',
        },
      ],
      (n) => `R${n}`,
      'pre',
      'post',
    );
    expect(blocks.length).toBe(1);
    expect(blocks[0]?.commandId).toBe('m');
    expect(blocks[0]?.items[0]).toContain('R1');
    expect(blocks[0]?.items[0]).toContain('pre');
  });
});
