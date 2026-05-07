import { visitRegExpAST } from '@eslint-community/regexpp';
import type { Pattern } from '@eslint-community/regexpp/ast';
import {
  semanticSpanFromAssertion,
  semanticSpanFromBackreference,
  semanticSpanFromCharacterClass,
  semanticSpanFromCharacterSet,
  semanticSpanFromNamedBackreference,
  semanticSpanFromQuantifier,
} from './astCommon';
import type { RegexSemanticSpan } from './types';

/**
 * 基于 regexpp AST 产出覆盖 lexer 薄弱处的语义片段（与 parse 同源）。
 *
 * @param astRoot 已解析的 pattern 根节点。
 * @returns 补丁 span 列表（可能与 lexer 重叠，由 merge 层裁决）。
 */
export function buildAstSemanticPatches(astRoot: Pattern): RegexSemanticSpan[] {
  const spans: RegexSemanticSpan[] = [];
  visitRegExpAST(astRoot, {
    onCharacterClassEnter(node) {
      spans.push(semanticSpanFromCharacterClass(node));
    },
    onQuantifierEnter(node) {
      spans.push(semanticSpanFromQuantifier(node));
    },
    onAssertionEnter(node) {
      spans.push(semanticSpanFromAssertion(node));
    },
    onCharacterSetEnter(node) {
      spans.push(semanticSpanFromCharacterSet(node));
    },
    onBackreferenceEnter(node) {
      spans.push(semanticSpanFromBackreference(node));
    },
    onNamedBackreferenceEnter(node) {
      spans.push(semanticSpanFromNamedBackreference(node));
    },
  });
  return spans;
}
