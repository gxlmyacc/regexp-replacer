import { collectBracketDiagnostics } from '../internal/collectBracketDiagnostics';
import type { RegexExpressionDiagnostic, RegexLintContext, RegexLintRule } from '../types';

/**
 * 将手写括号诊断映射为 error 级 RegexLint 规则（逻辑位于 internal/collectBracketDiagnostics）。
 *
 * 无入参（导出对象上的字段由管线读取）。
 */
export const bracketRule: RegexLintRule = {
  id: 'bracket',
  severity: 'error',
  collect(ctx: RegexLintContext): RegexExpressionDiagnostic[] {
    return collectBracketDiagnostics(ctx.text, ctx.language).map((d) => ({
      from: d.from,
      to: d.to,
      message: d.message,
      severity: 'error' as const,
    }));
  },
};
