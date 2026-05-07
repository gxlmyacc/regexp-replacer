import { visitRegExpAST } from '@eslint-community/regexpp';
import type { CharacterClass, CharacterClassElement, EscapeCharacterSet } from '@eslint-community/regexpp/ast';
import { getDict } from '../../../i18n';
import type { RegexExpressionDiagnostic, RegexLintContext, RegexLintRule } from '../types';

/**
 * 判断是否为 `\d`/`\w`/`\s` 简写（含否定形式）。
 *
 * @param el 字符类元素。
 * @returns 为 digit/word/space 的 EscapeCharacterSet 时为 true。
 */
function isDigitWordSpaceEscape(el: CharacterClassElement): el is EscapeCharacterSet {
  if (el.type !== 'CharacterSet') return false;
  const k = (el as EscapeCharacterSet).kind;
  return k === 'digit' || k === 'word' || k === 'space';
}

/**
 * 判断是否为「互补一对」组成的任意字符类（如 `[\s\S]`、`[\d\D]`、`[\w\W]`）。
 *
 * @param node ClassRanges 字符类节点。
 * @returns 符合互补简写对时为 true。
 */
function isComplementaryPairAnyCharClass(node: CharacterClass): boolean {
  if (node.unicodeSets !== false) return false;
  if (node.negate) return false;
  if (node.elements.length !== 2) return false;
  const [a, b] = node.elements;
  if (!isDigitWordSpaceEscape(a) || !isDigitWordSpaceEscape(b)) return false;
  if (a.kind !== b.kind) return false;
  return a.negate !== b.negate;
}

/**
 * 建议：`[\s\S]` 等与 dotAll 下 `.` 等价，可按当前 flags 简化或启用 `s`。
 */
export const dotAllEquivalentSuggestionRule: RegexLintRule = {
  id: 'dot-all-equivalent',
  severity: 'suggestion',
  /**
   * 扫描「互补简写」字符类并产出建议。
   *
   * @param ctx Lint 上下文。
   * @param _errorsSoFar 此前 error 列表（未使用）。
   * @returns 建议列表。
   */
  collect(ctx: RegexLintContext, _errorsSoFar: readonly RegexExpressionDiagnostic[]): RegexExpressionDiagnostic[] {
    const pattern = ctx.parsedPattern;
    if (!pattern) return [];
    const t = getDict(ctx.language);
    const dotAll = ctx.flags.includes('s');
    const out: RegexExpressionDiagnostic[] = [];

    visitRegExpAST(pattern, {
      onCharacterClassEnter(node: CharacterClass) {
        if (!isComplementaryPairAnyCharClass(node)) return;
        const message = dotAll ? t.regexSuggestionDotAllEquivalentUseDot : t.regexSuggestionDotAllEquivalentNeedFlag;
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
