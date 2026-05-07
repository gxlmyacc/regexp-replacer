import type { RegexBracketPair } from '../regexLint/internal/collectBracketPairs';

/**
 * 语义高亮类别（与 CSS class 解耦，仅描述正则片段角色）。
 */
export type RegexSemanticKind = 'escape' | 'class' | 'quant' | 'alt' | 'anchor' | 'dot';

/**
 * 半开区间 [from, to) 上的语义着色片段。
 */
export type RegexSemanticSpan = {
  from: number;
  to: number;
  kind: RegexSemanticKind;
};

/**
 * `buildRegexHighlightModel` 的元信息（调试 / Explain）。
 */
export type RegexHighlightMeta = {
  /** `parseRegExpPattern` 是否成功。 */
  parseOk: boolean;
  /** 是否合并了 AST 补丁（parse 成功且补丁非空）。 */
  usedAstEnhancement: boolean;
};

/**
 * 正则 pattern 高亮纯数据模型（不含编辑器 / CM）。
 */
export type RegexHighlightModel = {
  semanticSpans: RegexSemanticSpan[];
  bracketPairs: RegexBracketPair[];
  meta: RegexHighlightMeta;
};

export type { RegexBracketPair };
