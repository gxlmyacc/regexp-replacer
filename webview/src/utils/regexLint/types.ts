import type { RegExpSyntaxError } from '@eslint-community/regexpp/regexp-syntax-error';
import type { LanguageCode } from '../../i18n';
import type { Pattern } from '@eslint-community/regexpp/ast';

/** 正则表达式编辑器诊断严重程度（波浪线颜色分级）。 */
export type RegexDiagnosticSeverity = 'error' | 'warning' | 'suggestion';

/** 单条诊断：源码区间、提示文案、严重程度。 */
export type RegexExpressionDiagnostic = {
  from: number;
  to: number;
  message: string;
  severity: RegexDiagnosticSeverity;
};

/** 规则标识（便于测试与日志）。 */
export type RegexLintRuleId =
  | 'bracket'
  | 'engine-syntax'
  | 'redundant-escape'
  | 'orphan-numeric-backref'
  | 'char-class-shorthand-ascii'
  | 'quantifier-style'
  | 'dot-all-equivalent';

/**
 * 单次 Lint 聚合时的上下文：源码、引擎 flags、语言与可选的已解析 Pattern。
 *
 * @property text 正则 pattern 源码。
 * @property flags `new RegExp` 使用的 flags 字符串。
 * @property language UI 语言。
 * @property parsedPattern `parseRegExpPattern` 成功时的 AST 根（Pattern）；失败则为 undefined。
 * @property parseError `parseRegExpPattern` 失败时的语法错误（含 index）；成功则为 undefined。
 */
export type RegexLintContext = {
  text: string;
  flags: string;
  language: LanguageCode;
  parsedPattern: Pattern | undefined;
  parseError: RegExpSyntaxError | undefined;
};

/**
 * 单条 Lint 规则：产出若干诊断。
 *
 * @property id 规则标识。
 * @property severity 该规则产出的默认严重程度。
 * @property collect 收集函数。
 */
export type RegexLintRule = {
  id: RegexLintRuleId;
  severity: RegexDiagnosticSeverity;
  collect(ctx: RegexLintContext, errorsSoFar: readonly RegexExpressionDiagnostic[]): RegexExpressionDiagnostic[];
};
