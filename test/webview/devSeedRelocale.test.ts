import { describe, expect, test, vi, afterEach } from 'vitest';
import type { ReplaceCommand } from '../../src/types';
import {
  DEV_SEED_COMMAND_ID_PREFIX,
  fetchAndSanitizeDevSeedCommands,
  isDevSeedCommandId,
  mergeDevSeedDisplayFields,
} from '../../webview/src/utils/devSeedRelocale';

/**
 * 构造最小可用的 ReplaceCommand（满足合并逻辑所需字段）。
 *
 * @param id 命令 id。
 * @param patch 可选字段覆盖。
 * @returns 命令对象。
 */
function cmd(id: string, patch: Partial<ReplaceCommand> = {}): ReplaceCommand {
  return {
    id,
    title: 'T',
    rules: [{ engine: 'regex', find: '', replace: '', flags: 'g', title: 'R1' }],
    ...patch,
  };
}

describe('devSeedRelocale', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('isDevSeedCommandId：前缀匹配', () => {
    expect(isDevSeedCommandId(`${DEV_SEED_COMMAND_ID_PREFIX}a`)).toBe(true);
    expect(isDevSeedCommandId('cmd_x')).toBe(false);
  });

  test('mergeDevSeedDisplayFields：种子为空则返回原列表引用语义（同一数组）', () => {
    const cur: ReplaceCommand[] = [cmd('x')];
    expect(mergeDevSeedDisplayFields(cur, [])).toBe(cur);
  });

  test('mergeDevSeedDisplayFields：非演示 id 不修改', () => {
    const cur = [cmd('cmd_1', { title: 'A' })];
    const seed = [cmd(`${DEV_SEED_COMMAND_ID_PREFIX}1`, { title: 'Seed' })];
    const out = mergeDevSeedDisplayFields(cur, seed);
    expect(out[0]).toBe(cur[0]);
    expect(out[0].title).toBe('A');
  });

  test('mergeDevSeedDisplayFields：演示 id 在种子 Map 中无匹配则不变', () => {
    const cur = [cmd(`${DEV_SEED_COMMAND_ID_PREFIX}x`, { title: 'Old' })];
    const seed = [cmd(`${DEV_SEED_COMMAND_ID_PREFIX}y`, { title: 'Other' })];
    expect(mergeDevSeedDisplayFields(cur, seed)[0].title).toBe('Old');
  });

  test('mergeDevSeedDisplayFields：合并 title/description 与规则标题（trim 非空）', () => {
    const id = `${DEV_SEED_COMMAND_ID_PREFIX}demo`;
    const cur = [
      cmd(id, {
        title: 'OldTitle',
        description: 'oldDesc',
        rules: [{ engine: 'regex', find: 'a', replace: 'b', flags: 'g', title: 'OldRule' }],
      }),
    ];
    const seed = [
      cmd(id, {
        title: 'NewTitle',
        description: 'NewDesc',
        rules: [{ engine: 'regex', find: 'IGNORED', replace: 'IGNORED', flags: 'g', title: '  NewRule  ' }],
      }),
    ];
    const out = mergeDevSeedDisplayFields(cur, seed);
    expect(out[0].title).toBe('NewTitle');
    expect(out[0].description).toBe('NewDesc');
    expect(out[0].rules[0].title).toBe('NewRule');
    expect(out[0].rules[0].find).toBe('a');
  });

  test('mergeDevSeedDisplayFields：种子规则标题为空则保留原规则标题', () => {
    const id = `${DEV_SEED_COMMAND_ID_PREFIX}demo`;
    const cur = [cmd(id, { rules: [{ engine: 'regex', find: '', replace: '', flags: 'g', title: 'Keep' }] })];
    const seed = [
      cmd(id, {
        rules: [{ engine: 'regex', find: '', replace: '', flags: 'g', title: '   ' }],
      }),
    ];
    const out = mergeDevSeedDisplayFields(cur, seed);
    expect(out[0].rules[0].title).toBe('Keep');
  });

  test('mergeDevSeedDisplayFields：种子规则条数不足则保留对应原规则', () => {
    const id = `${DEV_SEED_COMMAND_ID_PREFIX}demo`;
    const cur = [
      cmd(id, {
        rules: [
          { engine: 'regex', find: '1', replace: '', flags: 'g', title: 'A' },
          { engine: 'regex', find: '2', replace: '', flags: 'g', title: 'B' },
        ],
      }),
    ];
    const seed = [
      cmd(id, {
        rules: [{ engine: 'regex', find: '', replace: '', flags: 'g', title: 'OnlyFirst' }],
      }),
    ];
    const out = mergeDevSeedDisplayFields(cur, seed);
    expect(out[0].rules[0].title).toBe('OnlyFirst');
    expect(out[0].rules[1].title).toBe('B');
  });

  test('fetchAndSanitizeDevSeedCommands：fetch 抛错返回 []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(fetchAndSanitizeDevSeedCommands('en')).resolves.toEqual([]);
  });

  test('fetchAndSanitizeDevSeedCommands：响应非 ok 返回 []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchAndSanitizeDevSeedCommands('zh-CN')).resolves.toEqual([]);
  });

  test('fetchAndSanitizeDevSeedCommands：成功则交给 sanitizeCommandsPayload', async () => {
    const payload = [
      {
        id: 'cmd_test',
        title: 'x',
        rules: [{ engine: 'regex', find: '', replace: '', flags: 'g' }],
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(payload),
      }),
    );
    const out = await fetchAndSanitizeDevSeedCommands('en');
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].id).toBe('cmd_test');
  });
});
