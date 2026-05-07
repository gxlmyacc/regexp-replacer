import { hasUnescapedCloseBracketAfter } from '../regexLint/internal/hasUnescapedCloseBracketAfter';
import type { RegexSemanticKind, RegexSemanticSpan } from './types';

/** 与 `utils/index` 中 `RegexTokenType` 对齐（避免循环依赖）。 */
type LexRegexTokenType =
  | 'text'
  | 'escape'
  | 'class'
  | 'group'
  | 'quant'
  | 'alt'
  | 'anchor'
  | 'dot';

type LexRegexToken = { type: LexRegexTokenType; value: string };

/**
 * 判断是否为十六进制数位字符。
 *
 * @param c 单字符。
 * @returns 是否为 [0-9a-fA-F]。
 */
function isHexDigit(c: string): boolean {
  return c !== undefined && /^[0-9a-fA-F]$/.test(c);
}

/**
 * 读取 `\xHH`（两位十六进制）。
 * Unicode 语义下须凑满两位，否则只吞 `\x`，避免误把非法尾部吃进 escape。
 * 非 Unicode 语义下仍尽可能吞掉已出现的十六进制位，减轻错位。
 *
 * @param s 全文。
 * @param backslash 反斜杠下标。
 * @param unicodeSemantics 含 `u` 或 `v` 时为 true。
 * @returns 结束下标（不含），指向 escape 序列之后的字符。
 */
function consumeHexEscape(s: string, backslash: number, unicodeSemantics: boolean): number {
  let j = backslash + 2;
  let count = 0;
  while (count < 2 && j < s.length && isHexDigit(s[j])) {
    j += 1;
    count += 1;
  }
  if (unicodeSemantics && count < 2) {
    return Math.min(backslash + 2, s.length);
  }
  return Math.min(s.length, Math.max(backslash + 2, j));
}

/**
 * 读取 `\uXXXX` 或 `\u{...}`。
 * Unicode 语义下 `\u` 非花括号形式须凑满四位十六进制，否则只吞 `\u`。
 *
 * @param s 全文。
 * @param backslash 反斜杠下标。
 * @param unicodeSemantics 含 `u` 或 `v` 时为 true。
 * @returns 结束下标（不含）。
 */
function consumeUnicodeEscape(s: string, backslash: number, unicodeSemantics: boolean): number {
  const x = s[backslash + 2];
  if (x === '{') {
    let j = backslash + 3;
    while (j < s.length && s[j] !== '}') j += 1;
    return j < s.length ? j + 1 : s.length;
  }
  let j = backslash + 2;
  let count = 0;
  while (count < 4 && j < s.length && isHexDigit(s[j])) {
    j += 1;
    count += 1;
  }
  if (unicodeSemantics && count < 4) {
    return Math.min(backslash + 2, s.length);
  }
  return Math.min(s.length, Math.max(backslash + 2, j));
}

/**
 * 读取 `\p{...}` / `\P{...}`（花括号平衡）。
 *
 * @param s 全文。
 * @param backslash 反斜杠下标。
 * @returns 结束下标（不含）。
 */
function consumeUnicodePropertyEscape(s: string, backslash: number): number {
  let j = backslash + 2;
  if (s[j] !== '{') return Math.min(backslash + 3, s.length);
  j += 1;
  let depth = 1;
  while (j < s.length && depth > 0) {
    const c = s[j];
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    j += 1;
  }
  return j;
}

/**
 * 读取 Unicode sets（`v`）字符类中的 `\q{...}` 字面串，按花括号深度配对；无 `{` 时只吞 `\q`。
 *
 * @param s 全文。
 * @param backslash `\` 的下标。
 * @returns 结束下标（不含）。
 */
function consumeClassStringPropertyEscape(s: string, backslash: number): number {
  let j = backslash + 2;
  if (s[j] !== '{') return backslash + 2;
  j += 1;
  let depth = 1;
  while (j < s.length && depth > 0) {
    const c = s[j];
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    j += 1;
  }
  return j;
}

/**
 * 读取 `\k<name>` / `\k'name'`（简化：名称内不允许未转义分隔符）。
 *
 * @param s 全文。
 * @param backslash 反斜杠下标。
 * @returns 结束下标（不含）。
 */
function consumeNamedBackreference(s: string, backslash: number): number {
  const opener = s[backslash + 2];
  if (opener !== '<' && opener !== "'") return Math.min(backslash + 3, s.length);
  const closer = opener === '<' ? '>' : "'";
  let j = backslash + 3;
  while (j < s.length && s[j] !== closer) {
    if (s[j] === '\\') j += 2;
    else j += 1;
  }
  return j < s.length ? j + 1 : s.length;
}

/**
 * 判断是否为 `\c` 所要求的 ASCII 控制字母（`A`–`Z` / `a`–`z`）。
 *
 * @param c 第三位字符，可能为 `undefined`。
 * @returns 是否为合法 ControlLetter。
 */
function isRegexControlLetter(c: string | undefined): boolean {
  return c !== undefined && /^[A-Za-z]$/.test(c);
}

/**
 * 读取 `\cX` 控制符：仅当第三位为 ControlLetter 时吞三位，否则只吞 `\c`（与 ES RegExp 解析一致，非法写法不误吞量词等）。
 *
 * @param s 全文。
 * @param backslash 反斜杠下标。
 * @returns 结束下标（不含）。
 */
function consumeControlEscape(s: string, backslash: number): number {
  const letter = s[backslash + 2];
  return isRegexControlLetter(letter) ? backslash + 3 : backslash + 2;
}

/**
 * 读取 `\` 起始的数值反向引用（贪婪数字）。
 *
 * @param s 全文。
 * @param backslash 反斜杠下标。
 * @returns 结束下标（不含）。
 */
function consumeNumericBackreference(s: string, backslash: number): number {
  let j = backslash + 1;
  while (j < s.length && s[j] >= '0' && s[j] <= '9') j += 1;
  return Math.max(backslash + 2, j);
}

/**
 * 读取 `\0` 起始转义：Unicode 语义下固定为两位 `\0`；否则按 Annex B 追加至多两个八进制位（共三位）。
 *
 * @param s 全文。
 * @param backslash `\` 的下标。
 * @param unicodeSemantics 是否启用 `u`/`v` 下的 DecimalEscape 规则（`\0` 后不得跟十进制位）。
 * @returns 结束下标（不含）。
 */
function consumeZeroDecimalEscape(s: string, backslash: number, unicodeSemantics: boolean): number {
  if (unicodeSemantics) {
    return Math.min(backslash + 2, s.length);
  }
  let j = backslash + 2;
  let digits = 1;
  while (digits < 3 && j < s.length) {
    const c = s[j];
    if (c >= '0' && c <= '7') {
      j += 1;
      digits += 1;
    } else {
      break;
    }
  }
  return j;
}

/**
 * 从反斜杠起 consume 整条 escape，返回结束下标（不含）。
 *
 * @param s 全文。
 * @param backslash `\` 的下标。
 * @param unicodeSemantics 含 `u` 或 `v` 时为 true，用于 `\0`、`\xHH`、`\uXXXX` 等与 Annex B/宽松吞字的交界。
 * @returns 下一个待扫描下标。
 */
function consumeBackslashEscape(s: string, backslash: number, unicodeSemantics: boolean): number {
  if (backslash + 1 >= s.length) return backslash + 1;
  const next = s[backslash + 1];
  switch (next) {
    case 'x':
      return consumeHexEscape(s, backslash, unicodeSemantics);
    case 'u':
      return consumeUnicodeEscape(s, backslash, unicodeSemantics);
    case 'p':
    case 'P':
      return consumeUnicodePropertyEscape(s, backslash);
    case 'q':
      return consumeClassStringPropertyEscape(s, backslash);
    case 'k':
      return consumeNamedBackreference(s, backslash);
    case 'c':
      return consumeControlEscape(s, backslash);
    case '0':
      return consumeZeroDecimalEscape(s, backslash, unicodeSemantics);
    default:
      if (next >= '1' && next <= '9') return consumeNumericBackreference(s, backslash);
      return backslash + 2;
  }
}

/**
 * 读取 `{m,n}` 量词主体（含花括号）；若不构成合法量词则只吞 `{`。
 *
 * @param s 全文。
 * @param openBrace `{` 下标。
 * @returns 结束下标（不含）。
 */
function consumeBraceQuantifier(s: string, openBrace: number): number {
  let j = openBrace + 1;
  while (j < s.length && s[j] >= '0' && s[j] <= '9') j += 1;
  if (j < s.length && s[j] === ',') {
    j += 1;
    while (j < s.length && s[j] >= '0' && s[j] <= '9') j += 1;
  }
  if (j < s.length && s[j] === '}') return j + 1;
  return openBrace + 1;
}

/**
 * 非 `v` 模式下扫描 `[` … `]`（含首槽 `]` 字面量特例）。
 *
 * @param s 全文。
 * @param openBracket `[` 的下标。
 * @returns 闭合 `]` 之后下标；未闭合则为 `s.length`。
 */
function consumeCharacterClassLegacy(s: string, openBracket: number, unicodeSemantics: boolean): number {
  let j = openBracket + 1;
  while (j < s.length) {
    const c = s[j];
    if (c === '\\') {
      j = consumeBackslashEscape(s, j, unicodeSemantics);
      continue;
    }
    if (c === ']') {
      const atFirstSlot = j === openBracket + 1;
      const atFirstSlotAfterCaret = s[openBracket + 1] === '^' && j === openBracket + 2;
      if ((atFirstSlot || atFirstSlotAfterCaret) && hasUnescapedCloseBracketAfter(s, j + 1)) {
        j += 1;
        continue;
      }
      return j + 1;
    }
    j += 1;
  }
  return j;
}

/**
 * `v`（Unicode sets）模式下字符类可嵌套 `[`，按深度配对直至最外层 `]`。
 *
 * @param s 全文。
 * @param openBracket `[` 的下标。
 * @returns 最外层闭合之后下标；未闭合则为 `s.length`。
 */
function consumeCharacterClassUnicodeSets(s: string, openBracket: number, unicodeSemantics: boolean): number {
  let depth = 1;
  let j = openBracket + 1;
  while (j < s.length && depth > 0) {
    const c = s[j];
    if (c === '\\') {
      j = consumeBackslashEscape(s, j, unicodeSemantics);
      continue;
    }
    if (c === '[') {
      depth += 1;
      j += 1;
      continue;
    }
    if (c === ']') {
      depth -= 1;
      j += 1;
      continue;
    }
    j += 1;
  }
  return j;
}

/**
 * 将相邻同类 token 合并（与历史 `tokenizeRegexPattern` 行为一致）。
 *
 * @param tokens 原始列表。
 * @returns 合并后的列表。
 */
function coalesceTokens(tokens: LexRegexToken[]): LexRegexToken[] {
  const out: LexRegexToken[] = [];
  for (const t of tokens) {
    if (!t.value) continue;
    const last = out[out.length - 1];
    if (last && last.type === t.type) last.value += t.value;
    else out.push({ type: t.type, value: t.value });
  }
  return out;
}

/**
 * 将 `RegexToken[]` 转为语义着色区间（跳过 `text` 与 `group`，括号由配对扫描负责）。
 *
 * @param tokens token 列表。
 * @returns 语义 span 列表。
 */
export function regexTokensToSemanticSpans(tokens: readonly LexRegexToken[]): RegexSemanticSpan[] {
  let offset = 0;
  const spans: RegexSemanticSpan[] = [];
  for (const t of tokens) {
    const len = t.value.length;
    const from = offset;
    const to = offset + len;
    offset = to;
    if (t.type === 'text' || t.type === 'group') continue;
    spans.push({ from, to, kind: t.type as RegexSemanticKind });
  }
  return spans;
}

/**
 * 对正则 pattern 做 flags 感知的分词（用于高亮底色与 Explain 降级）。
 *
 * - 含 **`v`**：字符类按嵌套 `[`/`]` 深度扫描（Unicode sets）。
 * - 否则：字符类走 Annex B 友好规则（含首槽 `]` 字面特例）。
 * - 含 **`u`** 或 **`v`**：`\0` 按 Unicode DecimalEscape 仅吞两位，后续数字单独成 token；无 Unicode 标志时 `\0` 可吞并至多三位八进制（Annex B）。
 * - **`\c`**：仅当第三位为 `A`–`Z` / `a`–`z` 时吞 `\cX`，否则只吞 `\c`，避免把 `\c*` 等量词吃进 escape。
 * - **`u`/`v` 下 `\x` / `\u`**：`\xHH`、`\uXXXX`（非 `\u{…}`）须位数凑满，否则只吞前缀 `\x` / `\u`，其余单独分词。
 * - **`\q{…}`**（常见于 `v` 字符类字面串）：按花括号平衡整段吞并；无 `{` 时只吞 `\q`。
 *
 * @param pattern 正则源码。
 * @param flags `new RegExp` 的 flags。
 * @returns token 列表。
 */
export function lexRegexPatternTokens(pattern: string, flags = ''): LexRegexToken[] {
  const unicodeSets = flags.includes('v');
  const unicodeSemantics = flags.includes('u') || unicodeSets;
  const s = String(pattern ?? '');
  const raw: LexRegexToken[] = [];
  const push = (type: LexRegexTokenType, value: string) => {
    if (!value) return;
    raw.push({ type, value });
  };

  let i = 0;
  while (i < s.length) {
    const ch = s[i];

    if (ch === '\\') {
      const end = consumeBackslashEscape(s, i, unicodeSemantics);
      push('escape', s.slice(i, end));
      i = end;
      continue;
    }

    if (ch === '[') {
      const end = unicodeSets
        ? consumeCharacterClassUnicodeSets(s, i, unicodeSemantics)
        : consumeCharacterClassLegacy(s, i, unicodeSemantics);
      push('class', s.slice(i, end));
      i = end;
      continue;
    }

    if (ch === '(' || ch === ')') {
      push('group', ch);
      i += 1;
      continue;
    }

    if (ch === '{') {
      const end = consumeBraceQuantifier(s, i);
      if (end > i + 1) {
        push('quant', s.slice(i, end));
        i = end;
        continue;
      }
      push('quant', '{');
      i += 1;
      continue;
    }

    if (ch === '*' || ch === '+' || ch === '?' || ch === '}') {
      push('quant', ch);
      i += 1;
      continue;
    }

    if (ch === '|') {
      push('alt', ch);
      i += 1;
      continue;
    }

    if (ch === '^' || ch === '$') {
      push('anchor', ch);
      i += 1;
      continue;
    }

    if (ch === '.') {
      push('dot', ch);
      i += 1;
      continue;
    }

    push('text', ch);
    i += 1;
  }

  return coalesceTokens(raw);
}
