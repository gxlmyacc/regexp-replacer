/**
 * 将模板中的 `{key}` 占位符依次替换为对应值（`vars` 的键不含花括号）。
 *
 * @param template 模板字符串（如 `'a={x}'`）。
 * @param vars 占位符名到替换文本的映射。
 * @returns 替换后的展示字符串。
 */
export function formatMessageTemplate(template: string, vars: Record<string, string>): string {
  let s = template;
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{${k}}`).join(v);
  }
  return s;
}
