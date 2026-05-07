import { collectBracketPairs } from '../regexLint/internal/collectBracketPairs';
import { parseRegExpPattern, type ParseRegExpPatternResult } from '../regexLint/parseRegExpPattern';
import { buildAstSemanticPatches } from './astPatches';
import { lexRegexPatternTokens, regexTokensToSemanticSpans } from './lexer';
import { mergeSemanticSpans } from './mergeSemanticSpans';
import type { RegexHighlightModel } from './types';

/**
 * 根据 pattern 与 flags 构建与 UI 无关的高亮数据模型（lexer + 可选 AST 补丁）。
 *
 * @param pattern 正则源码。
 * @param flags `new RegExp(pattern, flags)` 的 flags。
 * @param parseResult 可选的预解析结果（与诊断共用同一次 `parseRegExpPattern` 时可传入）。
 * @returns `RegexHighlightModel`。
 */
export function buildRegexHighlightModel(
  pattern: string,
  flags: string,
  parseResult?: ParseRegExpPatternResult,
): RegexHighlightModel {
  const source = String(pattern ?? '');
  const f = String(flags ?? '');
  const baseSpans = regexTokensToSemanticSpans(lexRegexPatternTokens(source, f));
  const parsed = parseResult ?? parseRegExpPattern(source, f);
  let astSpans: ReturnType<typeof buildAstSemanticPatches> = [];
  if (parsed.ok) {
    astSpans = buildAstSemanticPatches(parsed.pattern);
  }
  const semanticSpans = mergeSemanticSpans(baseSpans, astSpans);
  return {
    semanticSpans,
    bracketPairs: collectBracketPairs(source),
    meta: {
      parseOk: parsed.ok,
      usedAstEnhancement: parsed.ok && astSpans.length > 0,
    },
  };
}
