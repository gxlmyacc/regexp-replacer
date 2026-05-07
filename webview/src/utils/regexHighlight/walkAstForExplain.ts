import { visitRegExpAST } from '@eslint-community/regexpp';
import type { Pattern } from '@eslint-community/regexpp/ast';
import type { I18nMessages } from '../../i18n/index';
import { truncatePatternSnippet } from './astCommon';
import { formatMessageTemplate } from './formatTemplate';

/**
 * 遍历 AST，按 Explain 规则写入结构化段落（与 astPatches 共用 truncate / visit 入口形态）。
 *
 * @param astRoot 已解析 pattern。
 * @param source 正则全文。
 * @param t 文案表。
 * @param pushSegment 写入一条展示文案。
 * @returns 无返回值。
 */
export function walkAstForExplain(
  astRoot: Pattern,
  source: string,
  t: I18nMessages,
  pushSegment: (text: string) => void,
): void {
  const keySeen = new Set<string>();
  const pushUnique = (key: string, text: string) => {
    if (keySeen.has(key)) return;
    keySeen.add(key);
    pushSegment(text);
  };

  visitRegExpAST(astRoot, {
    onCapturingGroupEnter(node) {
      const snip = truncatePatternSnippet(source, node.start, node.end, 36);
      pushUnique(`cap-${node.start}`, formatMessageTemplate(t.explainRegexOutlineCapturingFmt, { snippet: snip }));
    },
    onGroupEnter(node) {
      const snip = truncatePatternSnippet(source, node.start, node.end, 36);
      pushUnique(`grp-${node.start}`, formatMessageTemplate(t.explainRegexOutlineGroupFmt, { snippet: snip }));
    },
    onAssertionEnter(node) {
      const snip = truncatePatternSnippet(source, node.start, node.end, 40);
      pushUnique(`as-${node.start}`, formatMessageTemplate(t.explainRegexOutlineAssertionFmt, { snippet: snip }));
    },
    onCharacterClassEnter(node) {
      const snip = truncatePatternSnippet(source, node.start, node.end, 32);
      pushUnique(`cc-${node.start}`, formatMessageTemplate(t.explainRegexOutlineCharClassFmt, { snippet: snip }));
    },
  });
}
