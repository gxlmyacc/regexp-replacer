export const en = {
  searchPlaceholder: 'Search',
  newCommand: 'New Command',
  newCommandDisabledReason: 'New Command (an unsaved untitled command exists)',
  newRule: 'New Rule',
  newRuleTip: 'New rule: one command can have multiple rules, executed in order.',
  save: 'Save',
  reset: 'Reset',
  ruleEditor: 'Rule Editor',
  testEditor: 'Test Editor',
  saveTestText: 'Save test text',
  saveTestTextTip:
    'When checked, the test text of the current rule will be saved to settings (rule.testText). When unchecked, it stays UI-only.',
  matches: 'Matches',
  replacementTemplate: 'Replacement Template',
  replaceModeReplace: 'Replace',
  replaceModeMap: 'Map',
  mappingTableTitle: 'Mapping',
  mappingColMatch: 'Match',
  mappingColReplace: 'Replace',
  mappingColExpr: 'Expression',
  mappingColTemplate: 'Template',
  mappingRegexModeLabel: 'Regex',
  mappingRegexModeTip:
    'When enabled, the mapping table switches to Expression/Template. In map mode, the main rule (find + flags) produces a matched fragment, then the table is applied to capture groups ($1..$n) in order and only the first matching row is used (table regex flags are fixed to g).',
  mappingAddRow: 'Add row',
  mappingDeleteRow: 'Delete row',
  mappingDuplicateKey: 'Duplicate match key.',
  mappingTableHelpIntro:
    'Mapping table is used in "Map" replace mode: it first matches the main rule (find + flags), then applies the table to capture groups ($1..$n) in order and uses only the first row that matches, writing the result back into the fragment.',
  mappingTableHelpMatch:
    '- Text mode: "Match/Replace" are literal text replacement (global) inside the fragment.\n- Regex mode: "Expression/Template" are JavaScript RegExp + String.replace template (global) inside the fragment (table regex flags are fixed to g).',
  mappingTableHelpReplace:
    'The replacement template supports VS Code-like escapes (\\n, \\t, \\\\) and JS tokens ($&, $1..$99, $$, $<name>).',
  mapOnlyRegex: 'Map mode only supports regex engine.',
  mapEmpty: 'Mapping table cannot be empty. Please add at least one rule.',
  mapMatchRequired: 'Each mapping row must have a non-empty Match value.',
  mapItemRegexInvalid: 'Invalid regex in mapping table.',
  copy: 'Copy',
  copied: 'Copied.',
  copyFailed: 'Copy failed.',
  truncated: 'Output is too large and has been truncated.',
  useCopyButton: 'Use the copy button to copy all.',
  ruleTitlePlaceholder: 'Rule title',
  ruleTitleDefaultTip:
    'If the rule title is empty, it will be shown as "Rule 1/Rule 2/…". You can rename rules to make them easier to remember and distinguish.',
  expressionPlaceholder: 'Enter expression',
  preview: 'Preview (first 2000 chars)',
  applyToTestEditor: 'Apply to Test Editor',
  replaceCount: 'Replace count',
  replaceTab: 'Replace',
  listTab: 'List',
  ruleLabel: 'Rule',
  ruleEnabled: 'Enabled',
  ruleDisabled: 'Disabled',
  ruleEnableTip:
    'Toggle whether this rule runs in real execution. Disabled rules are skipped in Replace in File / Replace in Selection; the test preview is not affected. If a command has all rules disabled, it is hidden from the IDE command picker (QuickPick).',
  noRuleSelected: 'No rule selected',
  dirty: 'dirty',
  saved: 'saved',
  engine: 'Engine',
  languageUi: 'Language',
  languageOptionEn: 'English',
  languageOptionZhCN: '简体中文',
  flags: 'Flags',
  currentRule: 'Current rule',
  details: 'Details',
  explain: 'Explain',
  writeBackToRule: 'Write back to rule',
  temporaryTemplateHint: 'This template is for temporary testing. Use "Write back to rule" to save it.',
  untitledCommand: 'Untitled command',
  deleteCommand: 'Delete command',
  deleteRule: 'Delete rule',
  moveDownCommand: 'Move down',
  confirmDeleteCommand: 'Delete this command?',
  hookDepModalDeleteTitle: 'Delete command',
  hookDepModalDisableTitle: 'Disable rule',
  hookDepIntroDelete:
    'Delete this command? This cannot be undone.\nIf other commands reference this command in pre/post hooks (per rule), they are listed below. On confirm, those references will be removed first, then the command will be deleted.',
  hookDepIntroDisableSimple:
    'Disable this rule? It will be skipped in real execution; the test preview is not affected.',
  hookDepIntroDisableDepsHint:
    'The commands below reference this command in pre/post hooks (per rule). Each line has its own checkbox. When the option below is checked, only checked rows will have the reference removed; unchecked rows keep it.',
  hookDepPhasePre: 'Pre hook',
  hookDepPhasePost: 'Post hook',
  hookDepRemoveFromOthers: 'Also remove checked references from pre/post hook lists in other commands',
  hookDepRowCheckboxAria: 'Remove this reference',
  confirmDeleteRule: 'Delete this rule?',
  renameCommand: 'Rename command',
  renameCommandTitle: 'Name this command',
  commandNamePlaceholder: 'Command name',
  confirm: 'Confirm',
  cancel: 'Cancel',
  nameRequired: 'Name is required.',
  nameDuplicate: 'Name already exists.',
  nameReservedChars: 'Name cannot contain reserved characters: <>[]',
  ruleTitleReservedChars: 'Rule title cannot contain reserved characters: <>[]',
  addRuleFirst: 'No savable rule in current command. Please add a rule expression first.',
  commandListTitle: 'List ({n})',
  import: 'Import',
  export: 'Export',
  importOk: 'Imported.',
  exportOk: 'Exported.',
  invalidJson: 'Invalid JSON.',
  preCommand: 'Pre',
  postCommand: 'Post',
  preCommandFull: 'Pre hook',
  postCommandFull: 'Post hook',
  applyPreHooks: 'Apply pre hooks',
  applyPostHooks: 'Apply post hooks',
  preCommandTip: 'Configure pre hooks for the current rule: executed in order before applying this rule.',
  postCommandTip: 'Configure post hooks for the current rule: executed in order after applying this rule.',
  applyPreHooksTip: 'When enabled, preview/apply will run pre hooks before the current rule.',
  applyPostHooksTip: 'When enabled, preview/apply will run post hooks after the current rule, and Copy uses the final text.',
  applyPrevRules: 'Apply previous rules',
  collapseSidebar: 'Collapse sidebar',
  expandSidebar: 'Expand sidebar',
  addHookPlaceholder: 'Add command…',
  loopBlocked: 'Blocked to avoid loops.',
  hookMax3: 'You can select up to 3 commands.',
  hookAlreadySelected: 'Already selected.',
  emptyText: '(empty)',
  replacePreviewHighlightChip: 'Highlight',
  replaceResultHighlightTip:
    'Click to toggle: selected highlights replaced spans in the Replace tab; unselected shows plain preview (often faster on large input).',
  flagG: 'g: global matching (affects match/replace scope)',
  flagI: 'i: ignore case',
  flagM: 'm: multiline (^/$ match line boundaries)',
  flagS: 's: dotAll (. matches newlines)',
  flagU: 'u: Unicode mode',
  flagY: 'y: sticky matching (from lastIndex)',

  detailsEngineFlags: 'engine: {engine} / flags: {flags}',
  detailsColMatch: 'Match',
  detailsColText: 'Text',
  detailsColGroups: 'Groups',
  detailsGroupLabel: 'Group {n}',
  detailsNoGroups: 'No capture groups or no match selected.',
  detailsMatchIndexLine: '#{index} [{start},{end}]',
  flagsNa: '(n/a)',

  explainEnginesTitle: 'Engines',
  explainEngineRegex: '- regex: JavaScript RegExp; flags g/i/m/s/u/y are supported.',
  explainEngineText: '- text: literal find; global replace by default.',
  explainEngineWildcard: '- wildcard: * ? \\n \\t \\s \\S; escape with \\* \\?; supports `\\s+`/`\\s*`/`\\s?` (and `\\S+`/`\\S*`/`\\S?`, `\\t+`/`\\t*`/`\\t?`, `\\n+`/`\\n*`/`\\n?`); executed via RegExp internally.',
  explainReplacementTitle: 'Replacement template',
  explainDollar1: '- $1..$99: capture group references',
  explainDollarAmp: '- $&: entire match',
  explainDollarBacktick: '- $`: text before match',
  explainDollarQuote: "- $': text after match",
  explainDollarDollar: '- $$: literal $',

  /** RegExp 语法错误（无引擎详情时的统称）。 */
  regexSyntaxErrorGeneric: 'Regex syntax error',
  /** RegExp 语法错误：带引擎归一化详情；{detail} 为短说明或原始 message。 */
  regexSyntaxErrorFmt: 'Regex syntax error: {detail}',
  regexSyntaxDetailUnterminatedCharacterClass: 'Unterminated character class (missing ])',
  regexSyntaxDetailUnterminatedGroup: 'Unterminated group (missing ))',
  regexSyntaxDetailNothingToRepeat: 'Nothing to repeat',
  regexSyntaxDetailInvalidFlags: 'Invalid regular expression flags',
  regexSyntaxDetailInvalidGroup: 'Invalid group',
  regexSyntaxDetailInvalidEscape: 'Invalid escape',
  regexSyntaxDetailUnmatched: 'Unmatched delimiter',
  /** 不必要转义警告（表达式编辑器波浪线 tooltip）。 */
  regexRedundantEscapeWarning: 'Redundant escape; this character does not need a backslash.',
  /** 字符类内 `\b` 易混：实为退格而非单词边界（与不必要转义同一告警级别）。 */
  regexRedundantEscapeCharClassBackspaceB:
    'Inside `[]`, `\\b` matches a BACKSPACE (U+0008), not a word boundary. Put `\\b` outside the class for word boundaries, or use `\\x08` if you meant backspace.',
  /** 数字反向引用此前无对应捕获组；{n} 为引用编号。 */
  regexOrphanNumericBackreferenceWarningFmt:
    'There is no capturing group {n} before this; the backslash may be redundant.',

  /** 警告：未使用 `u`/`v` 时字符类中的 `\d`/`\w`/`\s` 系列按传统 ASCII 倾向集合解释。 */
  regexWarningCharClassShorthandAscii:
    'Without `u`/`v`, `\\d`, `\\w`, and `\\s` inside character classes use legacy (ASCII‑biased) ranges; add `u` and use `\\p{...}` if you need Unicode semantics.',

  /** 建议：`[\s\S]` 等与已启用 `s` 时的 `.` 等价。 */
  regexSuggestionDotAllEquivalentUseDot:
    'This character class matches any character; with the `s` flag you can use `.` instead.',
  /** 建议：`[\s\S]` 等匹配含换行任意字符，可考虑 `.` 配合 `s`（dotAll）。 */
  regexSuggestionDotAllEquivalentNeedFlag:
    'This character class matches any character including newlines; consider `.` with the `s` (dotAll) flag if that matches your intent.',

  /** 建议：花括号量词 `{1}` 与单次匹配等价，可省略量词。 */
  regexSuggestionQuantifierBraceRedundantOne:
    'This `{1}` quantifier is redundant; the atom already matches exactly once.',
  /** 建议：`{1,}` 与 `+` 等价。 */
  regexSuggestionQuantifierBracePreferPlus: 'Use `+` instead of `{1,}` for the same meaning.',
  /** 建议：`{1,}?` 与 `+?` 等价。 */
  regexSuggestionQuantifierBracePreferPlusLazy: 'Use `+?` instead of `{1,}?` for the same meaning.',
  /** 建议：`{0,}` 与 `*` 等价。 */
  regexSuggestionQuantifierBracePreferStar: 'Use `*` instead of `{0,}` for the same meaning.',
  /** 建议：`{0,}?` 与 `*?` 等价。 */
  regexSuggestionQuantifierBracePreferStarLazy: 'Use `*?` instead of `{0,}?` for the same meaning.',
  /** 建议：`{0,1}` 与 `?` 等价。 */
  regexSuggestionQuantifierBracePreferOptional: 'Use `?` instead of `{0,1}` for the same meaning.',
  /** 建议：`{0,1}?` 与 `??` 等价。 */
  regexSuggestionQuantifierBracePreferOptionalLazy: 'Use `??` instead of `{0,1}?` for the same meaning.',
  /** 建议：`{n,n}` 简写；`{short}`/`{long}` 由规则替换为 `{3}` / `{3,3}` 等形式。 */
  regexSuggestionQuantifierBraceRedundantNNFmt:
    'You can write `{short}` instead of `{long}` for the same repetition count.',

  /** 括号诊断：多余的闭括号；{ch} 为字符本身。 */
  regexBracketUnmatchedClose: 'Unmatched closing bracket {ch}',
  /** 括号诊断：类型交叉；{expected} / {actual} 为字符。 */
  regexBracketMismatch: 'Bracket mismatch: expected {expected}, got {actual}',
  /** 括号诊断：未闭合的开括号；{ch} 为 (、[ 或 {。 */
  regexBracketUnmatchedOpen: 'Unmatched opening bracket {ch}',
};

