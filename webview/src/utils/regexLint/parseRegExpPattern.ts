import { RegExpParser, RegExpSyntaxError } from '@eslint-community/regexpp';
import type { Pattern } from '@eslint-community/regexpp/ast';

/**
 * 将运行时 flags 转为 regexpp `parsePattern` 的 flags 选项（Unicode / Unicode Sets）。
 *
 * @param flags `new RegExp` 的 flags 字符串。
 * @returns 传给 `parsePattern` 第四参的对象（无 `u`/`v` 时为 `{}`，兼容 Annex B 等）。
 */
function flagsToParseParam(flags: string): { unicode?: boolean; unicodeSets?: boolean } {
  const unicode = flags.includes('u');
  const unicodeSets = flags.includes('v');
  if (!unicode && !unicodeSets) return {};
  return { unicode, unicodeSets };
}

export type ParseRegExpPatternOk = { ok: true; pattern: Pattern };
export type ParseRegExpPatternFail = { ok: false; error: RegExpSyntaxError };
export type ParseRegExpPatternResult = ParseRegExpPatternOk | ParseRegExpPatternFail;

/**
 * 解析正则 pattern，供 Lint 规则共享同一棵 AST（失败时不抛异常）。
 *
 * @param source pattern 源码。
 * @param flags 与 `new RegExp(source, flags)` 一致的 flags。
 * @returns 成功返回 `{ ok: true, pattern }`，失败返回 `{ ok: false, error }`。
 */
export function parseRegExpPattern(source: string, flags: string): ParseRegExpPatternResult {
  const s = String(source ?? '');
  try {
    const parser = new RegExpParser({ ecmaVersion: 2025 });
    const pattern = parser.parsePattern(s, 0, s.length, flagsToParseParam(flags));
    return { ok: true, pattern };
  } catch (e) {
    if (e instanceof RegExpSyntaxError) {
      return { ok: false, error: e };
    }
    throw e;
  }
}
