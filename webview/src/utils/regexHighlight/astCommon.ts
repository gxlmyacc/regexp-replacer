import type {
  Backreference,
  CharacterClass,
  CharacterSet,
  NamedBackreference,
  Quantifier,
} from '@eslint-community/regexpp/ast';
import type { RegexSemanticSpan } from './types';

/**
 * CharacterClass 节点对应的语义着色区间。
 *
 * @param node AST 节点。
 * @returns span。
 */
export function semanticSpanFromCharacterClass(node: CharacterClass): RegexSemanticSpan {
  return { from: node.start, to: node.end, kind: 'class' };
}

/**
 * Quantifier 节点对应的语义着色区间。
 *
 * @param node AST 节点。
 * @returns span。
 */
export function semanticSpanFromQuantifier(node: Quantifier): RegexSemanticSpan {
  return { from: node.start, to: node.end, kind: 'quant' };
}

/**
 * Assertion 节点对应的语义着色区间。
 *
 * @param node AST 节点。
 * @returns span。
 */
export function semanticSpanFromAssertion(node: { start: number; end: number }): RegexSemanticSpan {
  return { from: node.start, to: node.end, kind: 'anchor' };
}

/**
 * CharacterSet 节点（`.`、`\d`、property 等）对应的语义着色区间。
 *
 * @param node AST 节点。
 * @returns span。
 */
export function semanticSpanFromCharacterSet(node: CharacterSet): RegexSemanticSpan {
  return {
    from: node.start,
    to: node.end,
    kind: node.kind === 'any' ? 'dot' : 'escape',
  };
}

/**
 * 数值反向引用节点对应的语义着色区间。
 *
 * @param node AST 节点。
 * @returns span。
 */
export function semanticSpanFromBackreference(node: Backreference): RegexSemanticSpan {
  return { from: node.start, to: node.end, kind: 'escape' };
}

/**
 * 命名反向引用节点对应的语义着色区间。
 *
 * @param node AST 节点。
 * @returns span。
 */
export function semanticSpanFromNamedBackreference(node: NamedBackreference): RegexSemanticSpan {
  return { from: node.start, to: node.end, kind: 'escape' };
}

/**
 * 截断 Explain / 提示用的源码片段。
 *
 * @param source 全文。
 * @param start 起始偏移（含）。
 * @param end 结束偏移（不含）。
 * @param maxLen 最大长度。
 * @returns 展示字符串。
 */
export function truncatePatternSnippet(source: string, start: number, end: number, maxLen: number): string {
  let s = source.slice(start, end);
  if (s.length > maxLen) s = `${s.slice(0, maxLen)}…`;
  return s;
}
