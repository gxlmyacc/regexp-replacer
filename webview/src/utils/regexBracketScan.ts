import { getDict, type LanguageCode } from '../i18n';

export type RegexBracketPair = {
  openOffset: number;
  closeOffset: number;
  depth: number;
  kind: 'round' | 'square' | 'curly';
};

export type RegexBracketDiagnostic = {
  from: number;
  to: number;
  message: string;
};

/**
 * 由开括号推导应与之配对的闭括号字符。
 *
 * @param open 开括号 `(`、`[` 或 `{`。
 * @returns 对应的闭括号字符。
 */
function closingCharForOpen(open: '(' | '[' | '{'): ')' | ']' | '}' {
  if (open === '(') return ')';
  if (open === '[') return ']';
  return '}';
}

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

/**
 * 收集所有可配对括号（支持 ()、[]、{}；字符类内括号视为字面量；忽略转义）。
 *
 * @param text 正则文本。
 * @returns 括号对列表。
 */
export function collectBracketPairs(text: string): RegexBracketPair[] {
  const stacks = {
    round: [] as { openOffset: number; depth: number }[],
    square: [] as { openOffset: number; depth: number }[],
    curly: [] as { openOffset: number; depth: number }[],
  };
  const pairs: RegexBracketPair[] = [];
  let escaped = false;
  let inCharClass = false;
  let charClassOpenOffset = -1;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (inCharClass) {
      if (ch === ']') {
        const atFirstSlot = i === charClassOpenOffset + 1;
        const atFirstSlotAfterCaret =
          text[charClassOpenOffset + 1] === '^' && i === charClassOpenOffset + 2;
        if (
          (atFirstSlot || atFirstSlotAfterCaret) &&
          hasUnescapedCloseBracketAfter(text, i + 1)
        ) {
          continue;
        }
        const top = stacks.square.pop();
        if (top) {
          pairs.push({ openOffset: top.openOffset, closeOffset: i, depth: top.depth, kind: 'square' });
        }
        inCharClass = false;
        charClassOpenOffset = -1;
      }
      continue;
    }

    if (ch === '(') {
      stacks.round.push({ openOffset: i, depth: stacks.round.length + 1 });
      continue;
    }
    if (ch === ')') {
      const top = stacks.round.pop();
      if (top) {
        pairs.push({ openOffset: top.openOffset, closeOffset: i, depth: top.depth, kind: 'round' });
      }
      continue;
    }
    if (ch === '[') {
      stacks.square.push({ openOffset: i, depth: stacks.square.length + 1 });
      inCharClass = true;
      charClassOpenOffset = i;
      continue;
    }
    if (ch === ']') {
      const top = stacks.square.pop();
      if (top) {
        pairs.push({ openOffset: top.openOffset, closeOffset: i, depth: top.depth, kind: 'square' });
      }
      continue;
    }
    if (ch === '{') {
      stacks.curly.push({ openOffset: i, depth: stacks.curly.length + 1 });
      continue;
    }
    if (ch === '}') {
      const top = stacks.curly.pop();
      if (top) {
        pairs.push({ openOffset: top.openOffset, closeOffset: i, depth: top.depth, kind: 'curly' });
      }
    }
  }
  return pairs;
}

/**
 * 收集括号配对诊断（支持 ()、[]、{}；字符类内不参与栈匹配；忽略转义）。
 *
 * @param text 正则文本。
 * @param language 界面语言（文案走 i18n）。
 * @returns 诊断列表（范围 + 本地化提示）。
 */
export function collectBracketDiagnostics(text: string, language: LanguageCode): RegexBracketDiagnostic[] {
  const t = getDict(language);
  const out: RegexBracketDiagnostic[] = [];
  const stack: { ch: '(' | '[' | '{'; offset: number }[] = [];
  const closeToOpen: Record<string, '(' | '[' | '{'> = { ')': '(', ']': '[', '}': '{' };
  let escaped = false;
  let inCharClass = false;
  let charClassOpenOffset = -1;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] as string;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (inCharClass) {
      if (ch === ']') {
        const atFirstSlot = i === charClassOpenOffset + 1;
        const atFirstSlotAfterCaret =
          text[charClassOpenOffset + 1] === '^' && i === charClassOpenOffset + 2;
        if (
          (atFirstSlot || atFirstSlotAfterCaret) &&
          hasUnescapedCloseBracketAfter(text, i + 1)
        ) {
          continue;
        }
        const top = stack[stack.length - 1];
        if (top?.ch === '[') stack.pop();
        inCharClass = false;
        charClassOpenOffset = -1;
      }
      continue;
    }

    if (ch === '(' || ch === '[' || ch === '{') {
      stack.push({ ch, offset: i });
      if (ch === '[') {
        inCharClass = true;
        charClassOpenOffset = i;
      }
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      const expected = closeToOpen[ch];
      const top = stack[stack.length - 1];
      if (!top) {
        out.push({
          from: i,
          to: i + 1,
          message: t.regexBracketUnmatchedClose.replace('{ch}', ch),
        });
        continue;
      }
      if (top.ch !== expected) {
        const expectedClose = closingCharForOpen(top.ch);
        out.push({
          from: i,
          to: i + 1,
          message: t.regexBracketMismatch.replace('{expected}', expectedClose).replace('{actual}', ch),
        });
        stack.pop();
        continue;
      }
      stack.pop();
    }
  }
  for (const item of stack) {
    out.push({
      from: item.offset,
      to: item.offset + 1,
      message: t.regexBracketUnmatchedOpen.replace('{ch}', item.ch),
    });
  }
  return out;
}
