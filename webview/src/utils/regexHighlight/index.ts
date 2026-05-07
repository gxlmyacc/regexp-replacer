/**
 * 正则 pattern 高亮纯数据层（无 CodeMirror），可与 `regexLint` 类似日后拆包。
 *
 * 公共 API：`buildRegexHighlightModel`（可选传入已解析的 `parseRegExpPattern` 结果）、`buildRegexExplainOutline(pattern, flags, t)`、类型与 lexer 导出。
 * 内部模块：`astCommon`（AST→span / 截断）、`walkAstForExplain`（Explain 专用遍历）、`formatTemplate`（`{key}` 文案占位）；请勿从包外 deep import，便于日后拆 npm。
 */

export { buildRegexHighlightModel } from './buildRegexHighlightModel';
export { buildAstSemanticPatches } from './astPatches';
export { mergeSemanticSpans } from './mergeSemanticSpans';
export { lexRegexPatternTokens, regexTokensToSemanticSpans } from './lexer';
export { buildRegexExplainOutline } from './explainOutline';
export type {
  RegexBracketPair,
  RegexHighlightMeta,
  RegexHighlightModel,
  RegexSemanticKind,
  RegexSemanticSpan,
} from './types';
export type { RegexExplainSegment } from './explainOutline';
