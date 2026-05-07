import { getDict } from '../../../i18n';
import { scanUnnecessaryEscapeRanges } from '../internal/scanUnnecessaryEscapeRanges';
import type { RegexExpressionDiagnostic, RegexLintContext, RegexLintRule } from '../types';

/**
 * 冗余转义警告规则：手写 scan；类内 `\b` 易混点通过 `hint: 'char-class-b'` 走同一规则与专项文案。
 */
export const redundantEscapeRule: RegexLintRule = {
  id: 'redundant-escape',
  severity: 'warning',
  collect(ctx: RegexLintContext): RegexExpressionDiagnostic[] {
    const redundantRanges = scanUnnecessaryEscapeRanges(ctx.text);
    const t = getDict(ctx.language);
    return redundantRanges.map((r) => ({
      from: r.from,
      to: r.to,
      message: r.hint === 'char-class-b' ? t.regexRedundantEscapeCharClassBackspaceB : t.regexRedundantEscapeWarning,
      severity: 'warning' as const,
    }));
  },
};
