import type { RegexSemanticSpan } from './types';

/**
 * 合并相邻且 kind 相同的 span，减少装饰数量。
 *
 * @param spans 已排序或无序的 span 列表。
 * @returns 合并后的新列表。
 */
function coalesceAdjacentSameKind(spans: RegexSemanticSpan[]): RegexSemanticSpan[] {
  const sorted = [...spans].sort((a, b) => a.from - b.from || a.to - b.to);
  const out: RegexSemanticSpan[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.kind === s.kind && last.to === s.from) last.to = s.to;
    else out.push({ ...s });
  }
  return out;
}

/**
 * 将 lexer 基底 span 与 AST 补丁合并：同一细分区间优先采用 AST 的 kind。
 *
 * @param base lexer 产出的 span。
 * @param ast AST 补丁 span（parse 失败时为空）。
 * @returns 合并并压缩后的 span。
 */
export function mergeSemanticSpans(base: RegexSemanticSpan[], ast: RegexSemanticSpan[]): RegexSemanticSpan[] {
  if (!ast.length) return coalesceAdjacentSameKind(base);
  const points = new Set<number>();
  for (const s of base) {
    points.add(s.from);
    points.add(s.to);
  }
  for (const s of ast) {
    points.add(s.from);
    points.add(s.to);
  }
  const sortedPts = [...points].sort((a, b) => a - b);
  const out: RegexSemanticSpan[] = [];
  for (let k = 0; k < sortedPts.length - 1; k += 1) {
    const from = sortedPts[k];
    const to = sortedPts[k + 1];
    if (to <= from) continue;
    const astHit = ast.find((a) => a.from <= from && a.to >= to);
    const baseHit = base.find((b) => b.from <= from && b.to >= to);
    const pick = astHit ?? baseHit;
    if (pick) out.push({ from, to, kind: pick.kind });
  }
  return coalesceAdjacentSameKind(out);
}
