import { visitRegExpAST } from '@eslint-community/regexpp';
import type { Backreference, Character, Node } from '@eslint-community/regexpp/ast';
import { getDict } from '../../../i18n';
import type { RegexExpressionDiagnostic, RegexLintContext, RegexLintRule } from '../types';

/**
 * 判断节点是否落在某一字符类子树内（类内的 `\1` 不按反向引用语义处理）。
 *
 * @param node AST 节点。
 * @returns 若在 CharacterClass 之下则为 true。
 */
function isUnderCharacterClass(node: Node): boolean {
  let p: Node['parent'] = node.parent;
  while (p) {
    if (p.type === 'CharacterClass') return true;
    p = p.parent;
  }
  return false;
}

/**
 * 非 Unicode 模式下可能被解析为「数值字符」的 `\`+数字串，按用户语义视作潜在数字反向引用。
 *
 * @param raw Character 节点 raw。
 * @returns 是否为 `\` + 至少一位非零起头的数字。
 */
function isLegacyNumericBackslashDigits(raw: string): boolean {
  return /^\\[1-9]\d*$/.test(raw);
}

/**
 * 统计在开括号偏移严格小于 `pos` 的捕获组个数。
 *
 * @param captureOpens 各捕获组开括号偏移（来自 AST `CapturingGroup.start`）。
 * @param pos 当前位置。
 * @returns 此前捕获组数量。
 */
function countPriorCaptures(captureOpens: readonly number[], pos: number): number {
  let n = 0;
  for (const s of captureOpens) {
    if (s < pos) n += 1;
  }
  return n;
}

/**
 * 孤儿数字反向引用：此前源码顺序中不存在第 N 个捕获组则给出 warning（regexpp AST + Annex B 下的 Character 兜底）。
 */
export const orphanNumericBackrefRule: RegexLintRule = {
  id: 'orphan-numeric-backref',
  severity: 'warning',
  collect(ctx: RegexLintContext): RegexExpressionDiagnostic[] {
    const pattern = ctx.parsedPattern;
    if (!pattern) return [];

    const captureOpens: number[] = [];
    const out: RegexExpressionDiagnostic[] = [];
    const t = getDict(ctx.language);

    visitRegExpAST(pattern, {
      onCapturingGroupEnter(node) {
        captureOpens.push(node.start);
      },
      onBackreferenceEnter(node: Backreference) {
        if (typeof node.ref !== 'number') return;
        const prior = countPriorCaptures(captureOpens, node.start);
        if (node.ref > prior) {
          out.push({
            from: node.start,
            to: node.end,
            message: t.regexOrphanNumericBackreferenceWarningFmt.replace('{n}', String(node.ref)),
            severity: 'warning',
          });
        }
      },
      onCharacterEnter(node: Character) {
        if (!isLegacyNumericBackslashDigits(node.raw)) return;
        if (isUnderCharacterClass(node)) return;
        const n = Number.parseInt(node.raw.slice(1), 10);
        if (!Number.isFinite(n)) return;
        const prior = countPriorCaptures(captureOpens, node.start);
        if (n > prior) {
          out.push({
            from: node.start,
            to: node.end,
            message: t.regexOrphanNumericBackreferenceWarningFmt.replace('{n}', String(n)),
            severity: 'warning',
          });
        }
      },
    });

    return out;
  },
};
