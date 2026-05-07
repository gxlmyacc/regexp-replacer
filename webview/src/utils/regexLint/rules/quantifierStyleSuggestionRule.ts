import { visitRegExpAST } from '@eslint-community/regexpp';
import type { Quantifier } from '@eslint-community/regexpp/ast';
import { getDict } from '../../../i18n';
import type { RegexExpressionDiagnostic, RegexLintContext, RegexLintRule } from '../types';

/**
 * 判断量词上界是否为「无界」（与 `a+` 等内部表示一致）。
 *
 * @param max `Quantifier.max`。
 * @returns 与 `+`/`*` 同语义的无界上界时为 true。
 */
function isUnboundedMax(max: number): boolean {
  return max === Number.POSITIVE_INFINITY;
}

/**
 * 量词风格建议：当源码使用花括号而可写成更短等价形式时给出建议（不触及已简写的 `+` `*` `?`）。
 */
export const quantifierStyleSuggestionRule: RegexLintRule = {
  id: 'quantifier-style',
  severity: 'suggestion',
  /**
   * 遍历 AST 中的花括号量词并产出建议诊断。
   *
   * @param ctx Lint 上下文。
   * @param _errorsSoFar 此前已收集的 error 列表（本规则未使用，仅为管线签名一致）。
   * @returns 建议级诊断列表。
   */
  collect(ctx: RegexLintContext, _errorsSoFar: readonly RegexExpressionDiagnostic[]): RegexExpressionDiagnostic[] {
    const pattern = ctx.parsedPattern;
    if (!pattern) return [];
    const t = getDict(ctx.language);
    const out: RegexExpressionDiagnostic[] = [];

    visitRegExpAST(pattern, {
      onQuantifierEnter(node: Quantifier) {
        if (!node.raw.includes('{')) return;
        let message: string | undefined;
        if (node.min === node.max && node.raw.includes(',')) {
          message =
            node.min === 1
              ? t.regexSuggestionQuantifierBraceRedundantOne
              : t.regexSuggestionQuantifierBraceRedundantNNFmt
                  .replace('{short}', `{${node.min}}`)
                  .replace('{long}', `{${node.min},${node.min}}`);
        } else if (node.min === 1 && node.max === 1) {
          message = t.regexSuggestionQuantifierBraceRedundantOne;
        } else if (node.min === 1 && isUnboundedMax(node.max)) {
          message = node.greedy ? t.regexSuggestionQuantifierBracePreferPlus : t.regexSuggestionQuantifierBracePreferPlusLazy;
        } else if (node.min === 0 && isUnboundedMax(node.max)) {
          message = node.greedy ? t.regexSuggestionQuantifierBracePreferStar : t.regexSuggestionQuantifierBracePreferStarLazy;
        } else if (node.min === 0 && node.max === 1) {
          message = node.greedy ? t.regexSuggestionQuantifierBracePreferOptional : t.regexSuggestionQuantifierBracePreferOptionalLazy;
        }
        if (!message) return;
        out.push({
          from: node.start,
          to: node.end,
          message,
          severity: 'suggestion',
        });
      },
    });

    return out;
  },
};
