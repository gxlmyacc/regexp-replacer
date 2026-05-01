import type { ReplaceRule } from '../types';

/**
 * 校验映射模式规则：用于执行阶段兜底，防止用户手工编辑 settings.json 导致运行时行为异常。
 *
 * @param rule 规则对象（建议传入已规范化后的 rule）。
 * @returns 无返回值；不合法时抛出 Error。
 */
export function validateMapRuleOrThrow(rule: ReplaceRule): void {
  const mode = (rule.replaceMode ?? 'template') as 'template' | 'map';
  if (mode !== 'map') return;

  if (rule.engine !== 'regex') {
    throw new Error('映射模式仅支持 regex 引擎。');
  }

  const map = rule.map;
  if (!map || !Array.isArray(map.cases) || map.cases.length === 0) {
    throw new Error('映射表不能为空，请至少添加 1 条规则。');
  }

  if (map.mode === 'regex') {
    for (const it of map.cases) {
      const src = String(it?.find ?? '');
      if (!src) continue;
      // 仅做语法校验：cases 内 flags 固定为 g
      new RegExp(src, 'g');
    }
  }
}

