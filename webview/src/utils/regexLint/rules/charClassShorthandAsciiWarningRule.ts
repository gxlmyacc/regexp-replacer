import { visitRegExpAST } from '@eslint-community/regexpp';
import type { CharacterClass, CharacterClassElement, EscapeCharacterSet } from '@eslint-community/regexpp/ast';
import { getDict } from '../../../i18n';
import type { RegexExpressionDiagnostic, RegexLintContext, RegexLintRule } from '../types';

/**
 * 判断字符类元素是否为 `\d`/`\D`/`\w`/`\W`/`\s`/`\S` 这类简写转义。
 *
 * @param el 字符类元素。
 * @returns 为 digit/word/space 的 EscapeCharacterSet 时为 true。
 */
function isDigitWordSpaceEscapeShorthand(el: CharacterClassElement): el is EscapeCharacterSet {
  if (el.type !== 'CharacterSet') return false;
  const k = (el as EscapeCharacterSet).kind;
  return k === 'digit' || k === 'word' || k === 'space';
}

/**
 * 是否为 `[\s\S]` / `[\d\D]` / `[\w\W]` 类互补简写（与 dot-all 建议重叠时不发 ASCII 简写警告）。
 *
 * @param node ClassRanges 字符类。
 * @returns 互补任意字符类时为 true。
 */
function isComplementaryPairAnyCharClass(node: CharacterClass): boolean {
  if (node.unicodeSets !== false) return false;
  if (node.negate) return false;
  if (node.elements.length !== 2) return false;
  const [a, b] = node.elements;
  if (!isDigitWordSpaceEscapeShorthand(a) || !isDigitWordSpaceEscapeShorthand(b)) return false;
  if (a.kind !== b.kind) return false;
  return a.negate !== b.negate;
}

/**
 * 在未使用 `u`/`v` 时，提示字符类中 `\d`/`\w`/`\s` 系列按传统集合解释（非完整 Unicode 语义）。
 */
export const charClassShorthandAsciiWarningRule: RegexLintRule = {
  id: 'char-class-shorthand-ascii',
  severity: 'warning',
  /**
   * 扫描 ClassRanges 字符类中的 digit/word/space 简写并产出警告。
   *
   * @param ctx Lint 上下文。
   * @param _errorsSoFar 此前 error 列表（未使用）。
   * @returns 警告列表。
   */
  collect(ctx: RegexLintContext, _errorsSoFar: readonly RegexExpressionDiagnostic[]): RegexExpressionDiagnostic[] {
    const pattern = ctx.parsedPattern;
    if (!pattern) return [];
    const f = ctx.flags;
    if (f.includes('u') || f.includes('v')) return [];

    const t = getDict(ctx.language);
    const out: RegexExpressionDiagnostic[] = [];

    visitRegExpAST(pattern, {
      onCharacterClassEnter(node: CharacterClass) {
        if (node.unicodeSets !== false) return;
        if (isComplementaryPairAnyCharClass(node)) return;
        const hit = node.elements.some((el) => isDigitWordSpaceEscapeShorthand(el));
        if (!hit) return;
        out.push({
          from: node.start,
          to: node.end,
          message: t.regexWarningCharClassShorthandAscii,
          severity: 'warning',
        });
      },
    });

    return out;
  },
};
