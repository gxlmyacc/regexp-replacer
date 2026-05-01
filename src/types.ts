export type ReplaceEngine = 'regex' | 'text' | 'wildcard';

export interface WildcardOptions {
  dotAll?: boolean;
}

export type MapReplaceMode = 'text' | 'regex';

export type MapReplaceItem = {
  find: string;
  replace: string;
};

export type MapReplaceConfig = {
  mode: MapReplaceMode;
  cases: MapReplaceItem[];
};

export interface ReplaceRule {
  /** 规则标题（可选），用于描述规则用途。 */
  title?: string;
  /**
   * 是否启用该规则：缺省视为启用。
   * 当 enable=false 时，该规则在真实执行（replaceInFile/replaceInSelection）中会被跳过。
   */
  enable?: boolean;
  /**
   * 替换模式：template 使用 `replace` 模板；map 使用 `map` 配置对捕获组 `$1..$n` 做 cases 匹配，并将命中的组替换回主匹配片段。
   * 缺省视为 template。
   */
  replaceMode?: 'template' | 'map';
  engine: ReplaceEngine;
  find: string;
  replace: string;
  /**
   * 测试文本（可选）：仅在 UI 勾选“保存测试文本”时落盘到 settings，用于下次打开 RegExp UI 时回填测试区。
   */
  testText?: string;
  /**
   * 映射表（自上而下优先匹配）：先用 `find + flags` 找到主匹配片段，再按 `$1..$n` 顺序对捕获组文本扫描 `map.cases`，
   * 仅应用第一条能匹配的规则；命中后会把主匹配片段内该捕获组的第一次出现替换为映射结果。
   * `mode='text'` 为纯文本匹配；`mode='regex'` 为正则匹配（cases 内 flags 固定 `g`）。
   */
  map?: MapReplaceConfig;
  flags?: string;
  wildcardOptions?: WildcardOptions;
  preCommands?: string[];
  postCommands?: string[];
}

export interface ReplaceCommand {
  id: string;
  title: string;
  description?: string;
  rules: ReplaceRule[];
}

