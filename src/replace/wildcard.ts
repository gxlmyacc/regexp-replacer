/**
 * 将通配符表达式转换为 JavaScript 正则表达式源码。
 *
 * @param pattern 通配符表达式，支持 `*`、`?`、`\\n`、`\\t`、`\\s`、`\\S`，以及 `\\*`、`\\?` 转义。
 * @param dotAll 是否允许 `*` 与 `?` 匹配换行。
 * @returns 转换后的正则源码字符串（不包含 `/.../` 定界符）。
 */
export function wildcardToRegexSource(pattern: string, dotAll: boolean): string {
  const anyChar = dotAll ? '[\\s\\S]' : '[^\\n]';

  let out = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];

    if (ch === '\\') {
      const next = pattern[i + 1];
      if (next === 'n') {
        out += '\\n';
        i += 1;
        const q = pattern[i + 1];
        if (q === '+' || q === '*' || q === '?') {
          out += q;
          i += 1;
        }
        continue;
      }
      if (next === 't') {
        out += '\\t';
        i += 1;
        const q = pattern[i + 1];
        if (q === '+' || q === '*' || q === '?') {
          out += q;
          i += 1;
        }
        continue;
      }
      if (next === 's') {
        out += '\\s';
        i += 1;
        const q = pattern[i + 1];
        if (q === '+' || q === '*' || q === '?') {
          out += q;
          i += 1;
        }
        continue;
      }
      if (next === 'S') {
        out += '\\S';
        i += 1;
        const q = pattern[i + 1];
        if (q === '+' || q === '*' || q === '?') {
          out += q;
          i += 1;
        }
        continue;
      }
      if (next === '*' || next === '?') {
        out += escapeRegexLiteral(next);
        i += 1;
        continue;
      }

      out += '\\\\';
      continue;
    }

    if (ch === '*') {
      out += `${anyChar}*`;
      continue;
    }

    if (ch === '?') {
      out += anyChar;
      continue;
    }

    out += escapeRegexLiteral(ch);
  }

  return out;
}

/**
 * 将文本按“字面量”转义成正则安全字符。
 *
 * @param text 要转义的文本。
 * @returns 转义后的文本。
 */
export function escapeRegexLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

