/**
 * 正则表达式编辑器诊断：对外门面（实现位于 regexLint）。
 */

export type { RegexDiagnosticSeverity, RegexExpressionDiagnostic } from './regexLint/types';
export { collectRegexExpressionDiagnostics, pickDiagnosticAtPosition } from './regexLint/runRegexExpressionLint';
