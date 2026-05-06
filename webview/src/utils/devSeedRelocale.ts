import type { ReplaceCommand } from '../../../src/types';
import type { LanguageCode } from '../i18n';
import { sanitizeCommandsPayload } from './index';

/** 与 `regexpReplacer.dev.commands.json` 中 id 约定一致，用于语言切换时定位可重载文案的演示命令。 */
export const DEV_SEED_COMMAND_ID_PREFIX = 'dev_sample_';

/**
 * 判断命令 id 是否属于开发环境预置演示数据。
 *
 * @param id 命令 id。
 * @returns 是否为演示种子命令。
 */
export function isDevSeedCommandId(id: string): boolean {
  return id.startsWith(DEV_SEED_COMMAND_ID_PREFIX);
}

/**
 * 将已按目标语言 sanitize 的种子列表中的「仅展示」字段合并进当前命令列表；
 * 不修改 find/replace/flags 等执行相关字段。
 *
 * @param current 当前命令列表。
 * @param localizedSeed 与种子 JSON 结构一致、且已按同一语言解析后的列表。
 * @returns 合并后的新列表（浅拷贝命令对象）。
 */
export function mergeDevSeedDisplayFields(current: ReplaceCommand[], localizedSeed: ReplaceCommand[]): ReplaceCommand[] {
  if (!localizedSeed.length) return current;
  const seedById = new Map(localizedSeed.map((c) => [c.id, c]));
  return current.map((cmd) => {
    if (!isDevSeedCommandId(cmd.id)) return cmd;
    const s = seedById.get(cmd.id);
    if (!s) return cmd;
    const nextRules = cmd.rules.map((r, i) => {
      const sr = s.rules[i];
      if (!sr) return r;
      const t = typeof sr.title === 'string' ? sr.title.trim() : '';
      if (!t) return r;
      return { ...r, title: t };
    });
    return {
      ...cmd,
      title: s.title,
      description: s.description,
      rules: nextRules,
    };
  });
}

/**
 * 拉取开发预置命令 JSON，并按指定界面语言做 sanitize（失败时返回空数组）。
 *
 * @param locale 界面语言。
 * @returns 清洗后的命令列表。
 */
export async function fetchAndSanitizeDevSeedCommands(locale: LanguageCode): Promise<ReplaceCommand[]> {
  try {
    const res = await fetch('/regexpReplacer.dev.commands.json', { cache: 'no-store' });
    if (!res.ok) return [];
    const raw = await res.json();
    return sanitizeCommandsPayload(raw, { locale });
  } catch {
    return [];
  }
}
