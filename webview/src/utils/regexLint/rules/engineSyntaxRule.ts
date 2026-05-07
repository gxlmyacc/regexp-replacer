import { getDict, type I18nMessages, type LanguageCode } from '../../../i18n';
import type { RegexExpressionDiagnostic, RegexLintContext, RegexLintRule } from '../types';

/**
 * 根据引擎英文关键词选取本地化详情句；无匹配则返回原始 message（多为英文）。
 *
 * @param message 引擎原始 message。
 * @param t 当前语言文案表。
 * @returns 展示用详情短句。
 */
function localizedRegexEngineDetail(message: string, t: I18nMessages): string {
  const m = message.toLowerCase();
  if (m.includes('unterminated character class')) return t.regexSyntaxDetailUnterminatedCharacterClass;
  if (m.includes('unterminated group')) return t.regexSyntaxDetailUnterminatedGroup;
  if (m.includes('nothing to repeat')) return t.regexSyntaxDetailNothingToRepeat;
  if (m.includes('invalid regular expression flags')) return t.regexSyntaxDetailInvalidFlags;
  if (m.includes('invalid group')) return t.regexSyntaxDetailInvalidGroup;
  if (m.includes('invalid escape')) return t.regexSyntaxDetailInvalidEscape;
  if (m.includes('unmatched')) return t.regexSyntaxDetailUnmatched;
  return message;
}

/**
 * 尝试以当前 flags 编译正则，失败时返回错误文案（仅当尚无括号类 error 时）。
 *
 * @param text 正则源码。
 * @param flags `new RegExp` flags。
 * @param language UI 语言。
 * @returns 错误文案；可编译则为 undefined。
 */
function collectRegexSyntaxErrorMessage(text: string, flags: string, language: LanguageCode): string | undefined {
  if (!text) return undefined;
  const t = getDict(language);
  try {
    const _compileProbe = new RegExp(text, flags);
    void _compileProbe;
    return undefined;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!message) return t.regexSyntaxErrorGeneric;
    const detail = localizedRegexEngineDetail(message, t);
    return t.regexSyntaxErrorFmt.replace('{detail}', detail);
  }
}

/**
 * 引擎级语法校验规则：`new RegExp(pattern, flags)`，与运行时一致；若 regexpp 解析失败且带有 index，则缩小高亮区间。
 */
export const engineSyntaxRule: RegexLintRule = {
  id: 'engine-syntax',
  severity: 'error',
  collect(ctx: RegexLintContext, errorsSoFar: readonly RegexExpressionDiagnostic[]): RegexExpressionDiagnostic[] {
    if (errorsSoFar.length > 0) return [];
    const syntaxMessage = collectRegexSyntaxErrorMessage(ctx.text, ctx.flags, ctx.language);
    const text = ctx.text;
    if (!syntaxMessage || text.length === 0) return [];
    const idx = ctx.parseError?.index;
    if (typeof idx === 'number' && idx >= 0) {
      if (idx >= text.length) {
        const from = text.length - 1;
        return [{ from, to: text.length, message: syntaxMessage, severity: 'error' }];
      }
      return [{ from: idx, to: idx + 1, message: syntaxMessage, severity: 'error' }];
    }
    return [{ from: 0, to: text.length, message: syntaxMessage, severity: 'error' }];
  },
};
