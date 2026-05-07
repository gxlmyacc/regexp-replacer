/**
 * 判断从某下标起是否存在未转义的 `]`（用于区分 `[]`/`[^]` 与首字符为字面量 `]` 的字符类）。
 *
 * @param text 正则全文。
 * @param start 扫描起始下标（通常为当前 `]` 的下一个字符）。
 * @returns 若其后仍存在未转义的 `]` 则为 true。
 */
export function hasUnescapedCloseBracketAfter(text: string, start: number): boolean {
  let escaped = false;
  for (let j = start; j < text.length; j += 1) {
    const c = text[j];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === '\\') {
      escaped = true;
      continue;
    }
    if (c === ']') return true;
  }
  return false;
}
