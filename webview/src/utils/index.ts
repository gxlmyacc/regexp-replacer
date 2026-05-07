import type { ReplaceCommand, ReplaceRule } from '../../../src/types';
import type { LanguageCode } from '../i18n';
import { countCapturingGroups } from './regexLint/countCapturingGroups';
import { lexRegexPatternTokens } from './regexHighlight/lexer';

export type RegexTokenType =
  | 'text'
  | 'escape'
  | 'class'
  | 'group'
  | 'quant'
  | 'alt'
  | 'anchor'
  | 'dot';

export type RegexToken = { type: RegexTokenType; value: string };

export type OffsetRangeItem = {
  startOffset: number;
  endOffset: number;
};

export type CommandLike = {
  title: string;
  description?: string;
  preCommands?: string[];
  postCommands?: string[];
  rules?: { preCommands?: string[]; postCommands?: string[]; find?: string; replace?: string }[];
};

export type SanitizeCommandsOptions = {
  /**
   * 界面语言：用于把 `title` / `description` / 规则标题等字段从双语对象解析为单语字符串。
   * 缺省为 `en`。
   */
  locale?: LanguageCode;
};

/**
 * 将配置中的「字符串或 { en, zh-CN }」解析为当前界面语言下的展示文本。
 *
 * @param value 原始值（string、双语对象或其它）。
 * @param locale 目标语言代码。
 * @returns 解析后的非空字符串；无法解析时返回空字符串。
 */
export function pickLocalizedString(value: unknown, locale: LanguageCode): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const o = value as Record<string, unknown>;
  const pick = (k: string): string => {
    const s = o[k];
    return typeof s === 'string' ? s.trim() : '';
  };
  const primary = locale === 'zh-CN' ? pick('zh-CN') : pick('en');
  if (primary) return primary;
  const en = pick('en');
  if (en) return en;
  const zh = pick('zh-CN');
  if (zh) return zh;
  for (const v of Object.values(o)) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/**
 * 生成一个简易唯一 id（用于 UI 内部临时标识，如拖拽 uid、表格行 uid）。
 *
 * @returns id 字符串。
 */
export function createId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 生成一个更短的命令 id（用于新建命令），形如 `cmd_xxxxxx`。
 *
 * @returns 命令 id。
 */
export function createCommandId(): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `cmd_${rnd}`;
}

/**
 * 创建一个“未命名命令”的草稿命令（用于每次打开 UI 便捷新增）。
 *
 * @param title 未命名标题文本（来自 i18n）。
 * @returns 草稿命令对象。
 */
export function createDraftCommand(title: string): ReplaceCommand {
  return {
    id: createCommandId(),
    title,
    rules: [{ engine: 'regex', find: '', replace: '', flags: 'g' }],
  };
}

/**
 * 创建一条默认规则（用于兜底生成最小可用配置）。
 *
 * @returns 默认规则对象。
 */
export function createDefaultRule(): ReplaceRule {
  return { engine: 'regex', find: '', replace: '', flags: 'g' };
}

/**
 * 将来自配置/导入的命令列表做容错清洗，避免脏数据导致 UI 崩溃。
 *
 * @param payload 原始 payload（可能来自导入文件或 VS Code 配置）。
 * @param options 可选配置（如界面语言，用于解析双语字段）。
 * @returns 清洗后的命令列表（保证每条命令都有 rules 数组，且至少 1 条规则）。
 */
export function sanitizeCommandsPayload(payload: unknown, options?: SanitizeCommandsOptions): ReplaceCommand[] {
  const locale: LanguageCode = options?.locale ?? 'en';
  const list = Array.isArray(payload) ? payload : [];
  const out: ReplaceCommand[] = [];
  const usedIds = new Set<string>();
  const usedTitlesLower = new Set<string>();
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as any;
    const rawTitle = pickLocalizedString(r.title, locale);
    if (!rawTitle) continue;

    // 导入文件可能没有 id：此时使用 title 生成一个稳定可读的 id（同时避免与现有 id 冲突）。
    let id = typeof r.id === 'string' ? String(r.id).trim() : '';
    if (!id) {
      id = buildCommandIdFromTitle(rawTitle);
    }
    while (usedIds.has(id)) id = `${id}_${createCommandId()}`;
    usedIds.add(id);

    // UI 里标题要求唯一；导入若重复则自动加后缀，避免丢数据/直接报错。
    let title = rawTitle;
    const baseLower = title.toLowerCase();
    if (usedTitlesLower.has(baseLower)) {
      let i = 2;
      while (usedTitlesLower.has(`${baseLower} (${i})`)) i += 1;
      title = `${title} (${i})`;
    }
    usedTitlesLower.add(title.toLowerCase());

    const rulesRaw = Array.isArray(r.rules) ? r.rules : [];
    const rules: ReplaceRule[] = rulesRaw
      .filter((x: unknown) => x && typeof x === 'object')
      .map((x: unknown) => {
        const rr = x as any;
        const engine = rr.engine === 'regex' || rr.engine === 'text' || rr.engine === 'wildcard' ? rr.engine : 'regex';
        const find = typeof rr.find === 'string' ? rr.find : '';
        const replace = typeof rr.replace === 'string' ? rr.replace : '';
        const flags = typeof rr.flags === 'string' ? rr.flags : 'g';
        const testText = typeof rr.testText === 'string' ? rr.testText : undefined;
        const enable = typeof rr.enable === 'boolean' ? rr.enable : undefined;
        const ruleTitleSrc = rr.title !== undefined && rr.title !== null ? rr.title : rr.name;
        const title2Pick = pickLocalizedString(ruleTitleSrc, locale);
        const title2 = title2Pick || undefined;
        const preCommands = Array.isArray(rr.preCommands) ? rr.preCommands.filter((s: unknown) => typeof s === 'string') : undefined;
        const postCommands = Array.isArray(rr.postCommands) ? rr.postCommands.filter((s: unknown) => typeof s === 'string') : undefined;
        const wildcardOptions =
          rr.wildcardOptions && typeof rr.wildcardOptions === 'object'
            ? {
                dotAll: typeof rr.wildcardOptions.dotAll === 'boolean' ? rr.wildcardOptions.dotAll : undefined,
              }
            : undefined;
        const rule: ReplaceRule = { engine, find, replace, flags };
        // enable 缺省视为启用：仅当为 false 时才保留落盘字段。
        if (enable === false) (rule as any).enable = false;
        if (title2) (rule as any).title = title2;
        if (testText !== undefined) (rule as any).testText = testText;
        if (preCommands) (rule as any).preCommands = preCommands;
        if (postCommands) (rule as any).postCommands = postCommands;
        if (wildcardOptions) (rule as any).wildcardOptions = wildcardOptions;
        return rule;
      })
      .filter((rr: ReplaceRule) => !!rr);

    const descPick = pickLocalizedString(r.description, locale);
    // 命令级 preCommands/postCommands 已废弃，扩展端不执行；此处不再落盘，避免与 README/类型定义不一致。
    out.push({
      id,
      title,
      description: descPick || undefined,
      rules: rules.length > 0 ? rules : [createDefaultRule()],
    } as any);
  }
  return out;
}

/**
 * 基于命令标题生成 id（用于导入时缺失 id 的场景）。
 *
 * @param title 命令标题。
 * @returns 命令 id。
 */
function buildCommandIdFromTitle(title: string): string {
  const slug = slugifyTitle(title);
  const hash = hashString(title);
  return slug ? `cmd_${slug}_${hash}` : `cmd_${hash}`;
}

/**
 * 将标题转为适合放入 id 的片段（只保留字母数字与 -）。
 *
 * @param title 标题文本。
 * @returns slug 字符串。
 */
function slugifyTitle(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s.slice(0, 32);
}

/**
 * 计算一个短 hash（用于稳定生成 id，避免 title 过长或包含不可用字符）。
 *
 * @param s 输入字符串。
 * @returns 十六进制 hash 字符串。
 */
function hashString(s: string): string {
  // djb2：足够用于本地稳定 id（非安全用途）
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

/**
 * 创建一个规则在 UI 内部使用的稳定 id（不落盘，用于拖拽排序后保持缓存不串）。
 *
 * @returns ruleUid 字符串。
 */
export function createRuleUid(): string {
  return `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 根据 textarea 内容自动调整高度，达到“单行起步、自动换行撑高”的效果。
 *
 * @param el textarea 元素。
 * @returns 无返回值。
 */
export function autoResizeTextarea(el: HTMLTextAreaElement): void {
  const anyEl = el as HTMLTextAreaElement & { __rrRafId?: number };
  if (anyEl.__rrRafId) cancelAnimationFrame(anyEl.__rrRafId);
  anyEl.__rrRafId = requestAnimationFrame(() => {
    anyEl.__rrRafId = undefined;
    // 使用 auto 可以减少同步布局抖动，避免触发 ResizeObserver loop 警告
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  });
}

/**
 * 把正则表达式（不含 / /）分词为便于高亮的 token 列表（flags 感知 lexer）。
 *
 * @param pattern 正则表达式字符串。
 * @param flags 可选 `new RegExp` flags（默认空串）。
 * @returns token 列表。
 */
export function tokenizeRegexPattern(pattern: string, flags = ''): RegexToken[] {
  return lexRegexPatternTokens(pattern, flags) as RegexToken[];
}

/**
 * 生成“规则 UI 缓存 key”，用于按（命令 + 规则）分别保存/恢复临时态。
 *
 * @param cmdId 命令 id。
 * @param ruleUid 规则在 UI 内部的稳定 id（不落盘，用于拖拽排序时保持缓存不串）。
 * @returns 缓存 key。
 */
export function buildRuleKey(cmdId: string, ruleUid: string): string {
  return `${cmdId}::${ruleUid}`;
}

/**
 * 判断标题是否属于“未命名命令”（跨语言兼容）。
 *
 * @param title 命令标题。
 * @returns 是否为未命名命令标题。
 */
export function isUntitledCommandTitle(title: string): boolean {
  return title === 'Untitled command' || title === '未命名命令';
}

/**
 * 判断一个命令是否还是“空白未命名草稿”（用于避免影响保存流程）。
 *
 * @param cmd 命令对象（结构化子集）。
 * @returns 是否为“空白未命名草稿”。
 */
export function isPristineUntitledDraft(cmd: CommandLike): boolean {
  if (!isUntitledCommandTitle(cmd.title)) return false;
  if (cmd.description && cmd.description.trim()) return false;
  if ((cmd.preCommands?.length ?? 0) > 0) return false;
  if ((cmd.postCommands?.length ?? 0) > 0) return false;
  if (!Array.isArray(cmd.rules) || cmd.rules.length !== 1) return false;
  const r = cmd.rules[0];
  if ((r.preCommands?.length ?? 0) > 0) return false;
  if ((r.postCommands?.length ?? 0) > 0) return false;
  if ((r.find ?? '').trim() !== '') return false;
  if ((r.replace ?? '').trim() !== '') return false;
  return true;
}

/**
 * 统一“未命名命令”的标题文本（用于语言切换时的历史标题归一化）。
 *
 * @param list 命令列表。
 * @param untitledTitle 当前语言的未命名标题。
 * @returns 归一化后的命令列表。
 */
export function normalizeCommandTitles<T extends { title: string }>(list: T[], untitledTitle: string): T[] {
  return list.map((c) => (isUntitledCommandTitle(c.title) ? { ...c, title: untitledTitle } : c));
}

/**
 * 根据 offset 定位当前命中的匹配项索引。
 *
 * @param items 匹配项数组（需包含 startOffset/endOffset）。
 * @param offset 目标 offset。
 * @returns 匹配索引；找不到则返回 undefined。
 */
export function getMatchIndexByOffset<T extends OffsetRangeItem>(items: T[], offset: number): number | undefined {
  if (!items.length) return undefined;
  let lo = 0;
  let hi = items.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const it = items[mid];
    if (offset < it.startOffset) hi = mid - 1;
    else if (offset > it.endOffset) lo = mid + 1;
    else return mid;
  }
  return undefined;
}

/**
 * 判断正则源码中是否存在至少 1 个“捕获组”（对应 $1..$n）。
 *
 * @param source 正则源码（不含 /.../）。
 * @returns 是否包含捕获组。
 */
export function hasAnyCapturingGroup(source: string): boolean {
  return countCapturingGroups(String(source ?? ''), '') > 0;
}

