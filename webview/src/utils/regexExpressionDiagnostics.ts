import { getDict, type I18nMessages, type LanguageCode } from '../i18n';
import { collectBracketDiagnostics } from './regexBracketScan';
import type { UnnecessaryEscapeRange } from './regexUnnecessaryEscapeScan';
import { scanUnnecessaryEscapeRanges } from './regexUnnecessaryEscapeScan';

/** 正则表达式编辑器诊断严重程度（波浪线颜色分级）。 */
export type RegexDiagnosticSeverity = 'error' | 'warning';

/** 单条诊断：源码区间、提示文案、严重程度。 */
export type RegexExpressionDiagnostic = {
  from: number;
  to: number;
  message: string;
  severity: RegexDiagnosticSeverity;
};

/**
 * 判断两个半开区间 [a,b) 与 [c,d) 是否相交。
 *
 * @param a 第一段起点（含）。
 * @param b 第一段终点（不含）。
 * @param c 第二段起点（含）。
 * @param d 第二段终点（不含）。
 * @returns 存在任意重叠则为 true。
 */
function rangesOverlap(a: number, b: number, c: number, d: number): boolean {
  return a < d && c < b;
}

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
 * 尝试编译正则，失败时返回面向用户的语法错误文案（走 i18n）。
 *
 * @param text 正则源码。
 * @param language UI 语言。
 * @returns 错误文案；可编译则为 undefined。
 */
function collectRegexSyntaxErrorMessage(text: string, language: LanguageCode): string | undefined {
  if (!text) return undefined;
  const t = getDict(language);
  try {
    new RegExp(text);
    return undefined;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!message) return t.regexSyntaxErrorGeneric;
    const detail = localizedRegexEngineDetail(message, t);
    return t.regexSyntaxErrorFmt.replace('{detail}', detail);
  }
}

/**
 * 聚合正则表达式编辑器的全部诊断：括号/语法错误 + 不必要转义警告；警告与错误区间相交则丢弃警告。
 *
 * @param text 正则源码。
 * @param language 当前 UI 语言（用于语法错误与警告文案）。
 * @returns 先 error 后 warning；tooltip 命中多条时应优先展示 error。
 */
export function collectRegexExpressionDiagnostics(text: string, language: LanguageCode): RegexExpressionDiagnostic[] {
  const errors: RegexExpressionDiagnostic[] = [];
  for (const d of collectBracketDiagnostics(text, language)) {
    errors.push({ from: d.from, to: d.to, message: d.message, severity: 'error' });
  }
  const bracketCount = errors.length;
  const syntaxMessage = collectRegexSyntaxErrorMessage(text, language);
  if (syntaxMessage && text.length > 0 && bracketCount === 0) {
    errors.push({ from: 0, to: text.length, message: syntaxMessage, severity: 'error' });
  }

  const redundantRanges = scanUnnecessaryEscapeRanges(text);
  const t = getDict(language);
  const warnMsg = t.regexRedundantEscapeWarning;
  const warnings: RegexExpressionDiagnostic[] = redundantRanges.map((r: UnnecessaryEscapeRange) => ({
    from: r.from,
    to: r.to,
    message: warnMsg,
    severity: 'warning',
  }));
  const filtered = warnings.filter((w) => !errors.some((e) => rangesOverlap(e.from, e.to, w.from, w.to)));

  return [...errors, ...filtered];
}

/**
 * 在诊断列表中选取光标位置命中的条目；同时命中错误与警告时优先返回错误。
 *
 * @param diagnostics collectRegexExpressionDiagnostics 的返回值。
 * @param pos 文档偏移。
 * @returns 命中的诊断；无命中则 undefined。
 */
export function pickDiagnosticAtPosition(
  diagnostics: RegexExpressionDiagnostic[],
  pos: number,
): RegexExpressionDiagnostic | undefined {
  const hits = diagnostics.filter((d) => d.from <= pos && pos <= d.to);
  if (hits.length === 0) return undefined;
  const err = hits.find((h) => h.severity === 'error');
  return err ?? hits[0];
}
