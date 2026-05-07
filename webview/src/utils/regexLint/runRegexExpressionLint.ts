import type { LanguageCode } from '../../i18n';
import { parseRegExpPattern } from './parseRegExpPattern';
import type { RegexExpressionDiagnostic, RegexLintContext, RegexLintRule } from './types';
import { bracketRule } from './rules/bracketRule';
import { engineSyntaxRule } from './rules/engineSyntaxRule';
import { redundantEscapeRule } from './rules/redundantEscapeRule';
import { orphanNumericBackrefRule } from './rules/orphanNumericBackrefRule';
import { charClassShorthandAsciiWarningRule } from './rules/charClassShorthandAsciiWarningRule';
import { quantifierStyleSuggestionRule } from './rules/quantifierStyleSuggestionRule';
import { dotAllEquivalentSuggestionRule } from './rules/dotAllEquivalentSuggestionRule';

/** error 阶段规则顺序（勿随意改动：engine-syntax 依赖 bracket 结果）。 */
const ERROR_RULES: readonly RegexLintRule[] = [bracketRule, engineSyntaxRule];

/** warning 阶段规则顺序。 */
const WARNING_RULES: readonly RegexLintRule[] = [
  redundantEscapeRule,
  orphanNumericBackrefRule,
  charClassShorthandAsciiWarningRule,
];

/** suggestion 阶段规则顺序（与 error/warning 区间重叠则丢弃）。 */
const SUGGESTION_RULES: readonly RegexLintRule[] = [quantifierStyleSuggestionRule, dotAllEquivalentSuggestionRule];

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
 * 聚合正则表达式 Lint：括号 → 引擎语法 → warning → suggestion；弱级别与更强级别区间相交则丢弃弱级别。
 *
 * @param text 正则 pattern 源码。
 * @param flags 与 `new RegExp(text, flags)` 一致的 flags。
 * @param language UI 语言。
 * @returns 顺序为 error → warning → suggestion。
 */
export function collectRegexExpressionDiagnostics(
  text: string,
  flags: string,
  language: LanguageCode,
): RegexExpressionDiagnostic[] {
  const parseResult = parseRegExpPattern(text, flags);
  const parsedPattern = parseResult.ok ? parseResult.pattern : undefined;
  const parseError = parseResult.ok ? undefined : parseResult.error;

  const ctx: RegexLintContext = {
    text,
    flags,
    language,
    parsedPattern,
    parseError,
  };

  const errors: RegexExpressionDiagnostic[] = [];
  for (const rule of ERROR_RULES) {
    errors.push(...rule.collect(ctx, errors));
  }

  const warnings: RegexExpressionDiagnostic[] = [];
  for (const rule of WARNING_RULES) {
    warnings.push(...rule.collect(ctx, errors));
  }

  const filteredWarnings = warnings.filter((w) => !errors.some((e) => rangesOverlap(e.from, e.to, w.from, w.to)));

  const suggestions: RegexExpressionDiagnostic[] = [];
  for (const rule of SUGGESTION_RULES) {
    suggestions.push(...rule.collect(ctx, errors));
  }

  const strongForSuggestion = [...errors, ...filteredWarnings];
  const filteredSuggestions = suggestions.filter(
    (s) => !strongForSuggestion.some((d) => rangesOverlap(d.from, d.to, s.from, s.to)),
  );

  return [...errors, ...filteredWarnings, ...filteredSuggestions];
}

/**
 * 在诊断列表中选取光标位置命中的条目；优先级 error → warning → suggestion。
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
  if (err) return err;
  const warn = hits.find((h) => h.severity === 'warning');
  if (warn) return warn;
  const sug = hits.find((h) => h.severity === 'suggestion');
  return sug ?? hits[0];
}
