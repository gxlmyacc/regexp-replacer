import { hasUnescapedCloseBracketAfter } from './hasUnescapedCloseBracketAfter';

/** 已成功配对的一组括号在源码中的位置与层级（用于编辑器括号着色）。 */
export type RegexBracketPair = {
  openOffset: number;
  closeOffset: number;
  depth: number;
  kind: 'round' | 'square' | 'curly';
};

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
        const atFirstSlotAfterCaret = text[charClassOpenOffset + 1] === '^' && i === charClassOpenOffset + 2;
        if ((atFirstSlot || atFirstSlotAfterCaret) && hasUnescapedCloseBracketAfter(text, i + 1)) {
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
