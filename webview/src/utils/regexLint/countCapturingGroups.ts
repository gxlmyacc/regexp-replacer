import { visitRegExpAST } from '@eslint-community/regexpp';
import { parseRegExpPattern } from './parseRegExpPattern';

/**
 * 统计 pattern 中捕获组个数（与 regexpp 按 ECMAScript 文法解析的 AST 一致）；解析失败返回 0。
 * 仅考虑 JavaScript `RegExp` 规则，其它正则方言不在范围内。
 *
 * @param pattern 正则源码。
 * @param flags `new RegExp` flags。
 * @returns 捕获组数量。
 */
export function countCapturingGroups(pattern: string, flags: string): number {
  const r = parseRegExpPattern(pattern, flags);
  if (!r.ok) return 0;
  let n = 0;
  visitRegExpAST(r.pattern, {
    onCapturingGroupEnter() {
      n += 1;
    },
  });
  return n;
}
