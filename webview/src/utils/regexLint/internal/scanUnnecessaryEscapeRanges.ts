import { hasUnescapedCloseBracketAfter } from './hasUnescapedCloseBracketAfter';

/** 不必要转义片段（半开区间）；`hint` 用于类内易混写法的专项文案。 */
export type UnnecessaryEscapeRange = {
  from: number;
  to: number;
  /** 字符类内 `\b`：实为退格而非单词边界。 */
  hint?: 'char-class-b';
};

/** 类外需反斜杠才能成为字面量或起语法作用的元字符集合（不含 `]`，类外 `]` 本身为字面量）。 */
const META_NEED_ESC_OUTSIDE = new Set('\\^$.|?*+()[{');

/**
 * 判断是否为十六进制数字字符。
 *
 * @param c 单字符或 undefined。
 * @returns 是否为 [0-9a-fA-F]。
 */
function isHex(c: string | undefined): boolean {
  return c !== undefined && /^[0-9a-fA-F]$/.test(c);
}

/**
 * 从 start 起读取连续十进制数字位数。
 *
 * @param s 全文。
 * @param start 起始下标。
 * @returns 连续数字个数（至少为 0）。
 */
function digitRunLength(s: string, start: number): number {
  let j = start;
  while (j < s.length && s[j] >= '0' && s[j] <= '9') j += 1;
  return j - start;
}

/**
 * 分析反斜杠起始位置处的转义：是否冗余、应跳过字符数。
 *
 * @param text 正则全文。
 * @param i 反斜杠下标。
 * @param inCharClass 是否在 `[...]` 字符类内。
 * @returns unnecessary 为 true 时表示需提示（多为可删反斜杠或类内 `\b` 易混）；advance 为本轮应前进的字符数（至少 1）；hint 为专项提示类别。
 */
function analyzeAfterBackslash(
  text: string,
  i: number,
  inCharClass: boolean,
): { unnecessary: boolean; advance: number; hint?: UnnecessaryEscapeRange['hint'] } {
  const next = text[i + 1];
  if (next === undefined) return { unnecessary: false, advance: 1 };

  if (inCharClass) {
    if (next === ']' || next === '\\') return { unnecessary: false, advance: 2 };
    if (next === '-') return { unnecessary: false, advance: 2 };

    if ('dDsSwW'.includes(next)) return { unnecessary: false, advance: 2 };
    // 类内 `\b` 为退格 U+0008，易被误认为单词边界；走冗余转义管线并附专项文案。
    if (next === 'b') return { unnecessary: true, advance: 2, hint: 'char-class-b' };
    if ('nrtvf'.includes(next)) return { unnecessary: false, advance: 2 };
    if (next === '0') return { unnecessary: false, advance: 2 };

    if (next >= '1' && next <= '9') {
      const run = digitRunLength(text, i + 1);
      return { unnecessary: false, advance: 1 + run };
    }

    if (next === 'c' && text[i + 2] !== undefined) return { unnecessary: false, advance: 3 };

    if (next === 'x') {
      if (isHex(text[i + 2]) && isHex(text[i + 3])) return { unnecessary: false, advance: 4 };
      return { unnecessary: false, advance: 2 };
    }

    if (next === 'u') {
      if (text[i + 2] === '{') {
        const end = text.indexOf('}', i + 3);
        if (end !== -1) return { unnecessary: false, advance: end - i + 1 };
        return { unnecessary: false, advance: Math.min(text.length - i, 3) };
      }
      if (isHex(text[i + 2]) && isHex(text[i + 3]) && isHex(text[i + 4]) && isHex(text[i + 5])) {
        return { unnecessary: false, advance: 6 };
      }
      return { unnecessary: false, advance: 2 };
    }

    if ((next === 'p' || next === 'P') && text[i + 2] === '{') {
      const end = text.indexOf('}', i + 3);
      if (end !== -1) return { unnecessary: false, advance: end - i + 1 };
      return { unnecessary: false, advance: Math.min(text.length - i, 4) };
    }

    if (next === 'k' && text[i + 2] === '<') {
      const end = text.indexOf('>', i + 3);
      if (end !== -1) return { unnecessary: false, advance: end - i + 1 };
      return { unnecessary: false, advance: Math.min(text.length - i, 3) };
    }

    return { unnecessary: true, advance: 2 };
  }

  if (next === '\\') return { unnecessary: false, advance: 2 };
  if (META_NEED_ESC_OUTSIDE.has(next)) return { unnecessary: false, advance: 2 };

  if ('dDsSwW'.includes(next)) return { unnecessary: false, advance: 2 };
  if (next === 'b' || next === 'B') return { unnecessary: false, advance: 2 };
  if ('nrtvf'.includes(next)) return { unnecessary: false, advance: 2 };
  if (next === '0') return { unnecessary: false, advance: 2 };

  if (next >= '1' && next <= '9') {
    const run = digitRunLength(text, i + 1);
    return { unnecessary: false, advance: 1 + run };
  }

  if (next === 'c' && text[i + 2] !== undefined) return { unnecessary: false, advance: 3 };

  if (next === 'x') {
    if (isHex(text[i + 2]) && isHex(text[i + 3])) return { unnecessary: false, advance: 4 };
    return { unnecessary: false, advance: 2 };
  }

  if (next === 'u') {
    if (text[i + 2] === '{') {
      const end = text.indexOf('}', i + 3);
      if (end !== -1) return { unnecessary: false, advance: end - i + 1 };
      return { unnecessary: false, advance: Math.min(text.length - i, 3) };
    }
    if (isHex(text[i + 2]) && isHex(text[i + 3]) && isHex(text[i + 4]) && isHex(text[i + 5])) {
      return { unnecessary: false, advance: 6 };
    }
    return { unnecessary: false, advance: 2 };
  }

  if ((next === 'p' || next === 'P') && text[i + 2] === '{') {
    const end = text.indexOf('}', i + 3);
    if (end !== -1) return { unnecessary: false, advance: end - i + 1 };
    return { unnecessary: false, advance: Math.min(text.length - i, 4) };
  }

  if (next === 'k' && text[i + 2] === '<') {
    const end = text.indexOf('>', i + 3);
    if (end !== -1) return { unnecessary: false, advance: end - i + 1 };
    return { unnecessary: false, advance: Math.min(text.length - i, 3) };
  }

  return { unnecessary: true, advance: 2 };
}

/**
 * 扫描正则源码，找出「不必要反斜杠」或类内 `\b` 易混点对应的半开区间（规则见 analyzeAfterBackslash）。
 *
 * @param text 正则源码。
 * @returns 区间列表（多为 `\` 与下一字符共 2 码元；类内 `\b` 带 `hint: 'char-class-b'`）。
 */
export function scanUnnecessaryEscapeRanges(text: string): UnnecessaryEscapeRange[] {
  const s = String(text ?? '');
  const out: UnnecessaryEscapeRange[] = [];
  let i = 0;
  let escaped = false;
  let inCharClass = false;
  let charClassOpenOffset = -1;

  while (i < s.length) {
    const ch = s[i];
    if (escaped) {
      escaped = false;
      i += 1;
      continue;
    }

    if (ch === '\\') {
      const { unnecessary, advance, hint } = analyzeAfterBackslash(s, i, inCharClass);
      if (unnecessary && advance >= 2) {
        const item: UnnecessaryEscapeRange = { from: i, to: i + advance };
        if (hint) item.hint = hint;
        out.push(item);
      }
      i += advance;
      continue;
    }

    if (inCharClass) {
      if (ch === ']') {
        const atFirstSlot = i === charClassOpenOffset + 1;
        const atFirstSlotAfterCaret = s[charClassOpenOffset + 1] === '^' && i === charClassOpenOffset + 2;
        if ((atFirstSlot || atFirstSlotAfterCaret) && hasUnescapedCloseBracketAfter(s, i + 1)) {
          i += 1;
          continue;
        }
        inCharClass = false;
        charClassOpenOffset = -1;
      }
      i += 1;
      continue;
    }

    if (ch === '[') {
      inCharClass = true;
      charClassOpenOffset = i;
    }

    i += 1;
  }

  return out;
}
