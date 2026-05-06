import { hasUnescapedCloseBracketAfter } from './regexBracketScan';

/** 捕获组开括号在源码中的偏移及其 1-based 编号（与 `$1..$n` 一致）。 */
export type RegexCapturingGroupOpen = {
  openOffset: number;
  index: number;
};

/** 命名捕获组「组名」片段区间（不含定界符 `<`/`>` 或引号），用于语法高亮。 */
export type RegexNamedGroupNameRange = {
  from: number;
  to: number;
};

export type RegexCaptureDecorScanResult = {
  /** 所有计入编号的捕获组开括号位置。 */
  capturingOpens: RegexCapturingGroupOpen[];
  /** 命名捕获组组名字符区间列表。 */
  namedGroupNameRanges: RegexNamedGroupNameRange[];
};

/**
 * 在从 `start` 起的子串中查找首个未转义的 `ch`（`ch` 为单字符）。
 *
 * @param s 全文。
 * @param start 起始下标。
 * @param ch 目标字符。
 * @returns 下标；找不到则返回 -1。
 */
function indexOfUnescapedChar(s: string, start: number, ch: string): number {
  let escaped = false;
  for (let j = start; j < s.length; j += 1) {
    const c = s[j];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === '\\') {
      escaped = true;
      continue;
    }
    if (c === ch) return j;
  }
  return -1;
}

/**
 * 跳过 `(?#` 注释内容，定位到注释结束后的第一个字符下标。
 *
 * @param s 全文。
 * @param iCommentBody 注释正文起始（`(?#` 之后的第一个字符下标）。
 * @returns 注释闭括号 `)` 的下一个下标；若未闭合则返回 `s.length`。
 */
function skipGroupCommentEnd(s: string, iCommentBody: number): number {
  let escaped = false;
  for (let j = iCommentBody; j < s.length; j += 1) {
    const c = s[j];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === '\\') {
      escaped = true;
      continue;
    }
    if (c === ')') return j + 1;
  }
  return s.length;
}

/**
 * 扫描正则源码：识别字符类/转义后，按 ECMAScript 常见规则区分捕获组与非捕获扩展，
 * 输出捕获组开括号编号及命名捕获组组名区间（用于编辑器装饰，不要求源码一定能通过 `new RegExp`）。
 *
 * @param pattern 正则源码（单行字符串）。
 * @returns 捕获开括号列表与命名组名区间列表。
 */
export function scanRegexCaptureDecorHints(pattern: string): RegexCaptureDecorScanResult {
  const s = String(pattern ?? '');
  const capturingOpens: RegexCapturingGroupOpen[] = [];
  const namedGroupNameRanges: RegexNamedGroupNameRange[] = [];
  let captureCount = 0;

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
      escaped = true;
      i += 1;
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
      i += 1;
      continue;
    }

    if (ch === '(') {
      if (s.startsWith('(?:', i) || s.startsWith('(?=', i) || s.startsWith('(?!', i)) {
        i += 3;
        continue;
      }
      if (s.startsWith('(?<=', i) || s.startsWith('(?<!', i)) {
        i += 4;
        continue;
      }
      if (s.startsWith('(?#', i)) {
        i = skipGroupCommentEnd(s, i + 3);
        continue;
      }
      if (s.startsWith('(?<', i) && !s.startsWith('(?<=', i) && !s.startsWith('(?<!', i)) {
        const nameStart = i + 3;
        const gt = indexOfUnescapedChar(s, nameStart, '>');
        if (gt !== -1) {
          captureCount += 1;
          capturingOpens.push({ openOffset: i, index: captureCount });
          if (gt > nameStart) {
            namedGroupNameRanges.push({ from: nameStart, to: gt });
          }
          i = gt + 1;
          continue;
        }
        captureCount += 1;
        capturingOpens.push({ openOffset: i, index: captureCount });
        i += 1;
        continue;
      }
      if (s.startsWith("(?'", i)) {
        const nameStart = i + 3;
        const q = indexOfUnescapedChar(s, nameStart, "'");
        if (q !== -1) {
          captureCount += 1;
          capturingOpens.push({ openOffset: i, index: captureCount });
          if (q > nameStart) {
            namedGroupNameRanges.push({ from: nameStart, to: q });
          }
          i = q + 1;
          continue;
        }
        captureCount += 1;
        capturingOpens.push({ openOffset: i, index: captureCount });
        i += 1;
        continue;
      }
      captureCount += 1;
      capturingOpens.push({ openOffset: i, index: captureCount });
      i += 1;
      continue;
    }

    i += 1;
  }

  return { capturingOpens, namedGroupNameRanges };
}

/**
 * 仅返回捕获组开括号位置与 1-based 编号（`$1..$n` 顺序）。
 *
 * @param pattern 正则源码。
 * @returns 开括号列表。
 */
export function collectCapturingGroupOpenOffsets(pattern: string): RegexCapturingGroupOpen[] {
  return scanRegexCaptureDecorHints(pattern).capturingOpens;
}
