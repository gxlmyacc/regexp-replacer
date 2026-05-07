import type { I18nMessages } from '../../i18n/index';
import { parseRegExpPattern } from '../regexLint/parseRegExpPattern';
import { formatMessageTemplate } from './formatTemplate';
import { lexRegexPatternTokens } from './lexer';
import { walkAstForExplain } from './walkAstForExplain';

/**
 * Explain 面板中单条结构说明。
 */
export type RegexExplainSegment = {
  /** 展示用纯文本（可含简短源码摘录）。 */
  text: string;
};

/**
 * lexer token 类型转为界面可读标签。
 *
 * @param type token 类型名。
 * @param t 文案表。
 * @returns 本地化标签。
 */
function lexerTokenTypeLabel(type: string, t: I18nMessages): string {
  switch (type) {
    case 'escape':
      return t.explainRegexTokEscape;
    case 'class':
      return t.explainRegexTokClass;
    case 'group':
      return t.explainRegexTokGroup;
    case 'quant':
      return t.explainRegexTokQuant;
    case 'alt':
      return t.explainRegexTokAlt;
    case 'anchor':
      return t.explainRegexTokAnchor;
    case 'dot':
      return t.explainRegexTokDot;
    case 'text':
      return t.explainRegexTokText;
    default:
      return type;
  }
}

/**
 * 为「说明」页生成基于 AST 的结构提纲；解析失败时降级为 lexer token 摘要。
 *
 * @param pattern 正则源码。
 * @param flags flags 字符串。
 * @param t 界面文案（中英字典）。
 * @returns 分段列表与解析是否成功。
 */
export function buildRegexExplainOutline(
  pattern: string,
  flags: string,
  t: I18nMessages,
): { parseOk: boolean; segments: RegexExplainSegment[]; parseErrorDetail?: string } {
  const source = String(pattern ?? '');
  const f = String(flags ?? '');
  const parsed = parseRegExpPattern(source, f);

  if (!parsed.ok) {
    const msg = parsed.error.message ?? String(parsed.error);
    const tokens = lexRegexPatternTokens(source, f);
    const interesting = tokens.filter((tok) => tok.type !== 'text').slice(0, 16);
    const segments: RegexExplainSegment[] = [{ text: formatMessageTemplate(t.explainRegexParseErrorFmt, { detail: msg }) }];
    if (!source.trim()) {
      segments.push({ text: t.explainRegexEmptyPattern });
      return { parseOk: false, segments, parseErrorDetail: msg };
    }
    for (const tok of interesting) {
      const v = tok.value.length > 28 ? `${tok.value.slice(0, 28)}…` : tok.value;
      segments.push({
        text: formatMessageTemplate(t.explainRegexLexerLineFmt, {
          type: lexerTokenTypeLabel(tok.type, t),
          value: v,
        }),
      });
    }
    return { parseOk: false, segments, parseErrorDetail: msg };
  }

  const segments: RegexExplainSegment[] = [];
  if (source.trim()) {
    segments.push({
      text: formatMessageTemplate(t.explainRegexFlagsLineFmt, {
        flags: f ? f : t.explainRegexFlagsNone,
      }),
    });
  } else {
    segments.push({ text: t.explainRegexEmptyPattern });
    return { parseOk: true, segments };
  }

  walkAstForExplain(parsed.pattern, source, t, (text) => {
    segments.push({ text });
  });

  return { parseOk: true, segments };
}
