import { getDict, type LanguageCode } from '../../../i18n';
import { hasUnescapedCloseBracketAfter } from './hasUnescapedCloseBracketAfter';

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
