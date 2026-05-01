# 正则替换器（VS Code 扩展）

为 VS Code 提供可复用的 **正则 / 文本 / 通配符** 替换命令。

## 功能

- **在文件中替换**：对当前活动编辑器文档执行已配置的替换命令。
- **在选中文本中替换**：对当前选区（支持多选区）执行已配置的替换命令。
- **RegExp UI**：打开 Webview 页面管理/创建/编辑命令并测试规则。
- **命令前置/后置**：在替换命令前后执行 VS Code 命令 id。
- **导入 / 导出（RegExp UI）**：以 JSON 文件导入/导出命令配置。
- **可拖拽布局（RegExp UI）**：拖拽分割线调整左侧命令列表宽度与底部工具区高度。
- **可选快捷图标/菜单**：可将入口放在编辑器标题栏或底部状态栏左/右侧；点击后选择「在文件中替换」「在选中文本中替换」「RegExp UI」（标题栏为子菜单，状态栏为 QuickPick）。

## 配置

命令配置存储在 VS Code Settings 中：

- `regexpReplacer.commands`: `ReplaceCommand[]`
- `regexpReplacer.ui.showIcon`: `boolean`（是否显示快捷入口）
- `regexpReplacer.ui.iconPlacement`: `editor | statusBarLeft | statusBarRight`（默认 `editor`：`editor` 为编辑器标题栏；`statusBarLeft` / `statusBarRight` 为底部状态栏左/右侧，点击后弹出 QuickPick）

每个命令可包含多条规则，按顺序执行：

- `enable`（可选）：`boolean`（默认：`true`）。当为 `false` 时，该规则在**在文件中替换 / 在选中文本中替换**中会被跳过。
- `engine`：`regex | text | wildcard`
- `find`：查找模式字符串
- `replace`：替换模板（遵循 JavaScript `String.replace` 语法，例如 `$1`、`$&`、`$$`）
- `replaceMode`（可选）：`template | map`（默认：`template`）
- `map`（可选）：`{ mode: "text" | "regex", cases: Array<{ find: string, replace: string }> }`（仅当 `replaceMode` 为 `map` 时生效）
- `flags`（仅 regex）：`g i m s u y d`
- `wildcardOptions.dotAll`（仅 wildcard）：是否允许 `*` / `?` 匹配换行

### 替换模式：`map`（映射）

在 **map** 模式下，规则会：

- 先使用主规则（`find` + `flags`）匹配出片段；
- 再仅对捕获组 `$1..$n`（按顺序）应用 `map.cases`：自上而下扫描表格，**仅对第一个命中的捕获组执行第一条能匹配成功的规则**，并将结果写回该片段中：
  - `map.mode="text"`：对捕获组文本做纯文本（字面量）全局替换
  - `map.mode="regex"`：对捕获组文本做正则全局替换（表格内正则 flags 固定为 `g`）
- `map` 模式仅支持 `engine: "regex"`。
- cases 中每条规则的 `replace` 与普通替换模板一致：支持 `\\n`、`\\t`、`\\\\` 以及 `$&`、`$1..$99`、`$$`、`$<name>`。

### `settings.json` 配置格式示例

下面示例可直接粘贴到 VS Code 的 `settings.json` 中。

```json
{
  "regexpReplacer.commands": [
    {
      "id": "demo-text",
      "title": "Demo: 文本替换",
      "description": "替换字面量子串",
      "preCommands": ["editor.action.formatDocument"],
      "postCommands": [],
      "rules": [
        {
          "engine": "text",
          "find": "foo",
          "replace": "bar"
        }
      ]
    },
    {
      "id": "demo-regex",
      "title": "Demo: 正则替换",
      "rules": [
        {
          "title": "可选标题，用于区分规则",
          "engine": "regex",
          "find": "(\\\\d+)",
          "replace": "Number($1)",
          "flags": "gim",
          "preCommands": ["demo-text"],
          "postCommands": []
        },
        {
          "engine": "wildcard",
          "find": "hello*world\\\\n?",
          "replace": "hi",
          "wildcardOptions": { "dotAll": true }
        },
        {
          "engine": "regex",
          "find": "x=([A-Z])",
          "replaceMode": "map",
          "map": {
            "mode": "text",
            "cases": [
              { "find": "A", "replace": "AA" },
              { "find": "C", "replace": "CC" }
            ]
          },
          "replace": "",
          "flags": "g"
        }
      ]
    }
  ]
}
```

说明：

- **替换模板**：遵循 JavaScript `String.replace` 模板语法（例如 `$1`、`$&`、`$'`、`$$`）。
- **通配符引擎**：支持类 glob 的 `*` / `?` 以及 `\\n`。如需 `*` / `?` 能匹配换行，请设置 `wildcardOptions.dotAll=true`。
- **规则启用开关**：
  - 若某命令下**所有规则都禁用**，该命令将不会出现在 IDE 的命令选择（QuickPick）中。
  - 通过 `preCommands` / `postCommands` 触发的命令链执行，**不会按 `enable` 过滤**。
- **前置/后置命令（`preCommands` / `postCommands`）**：
  - **命令级**：可填写 VS Code command id，或填写其它已配置命令的 `id`（用于链式执行）。
  - **规则级（可选）**：RegExp UI 支持按规则配置；扩展会在**每条规则执行前/后**执行对应 hook（若规则未配置则回退到命令级）。
  - 若执行过程中检测到命令链**死循环**，扩展会**中止执行**并提示循环链路，避免用户手动配置导致卡死。

## RegExp UI 说明

- 左侧命令列表顶部会保留一个 **未命名命令** 草稿，便于快速新增（若保持空白则不会保存到配置）。
- 临时替换模板、底部页签等属于 **UI 临时态**，会按（命令 + 规则）缓存以便切换还原，但**不会写入 Settings**。
- 测试文本默认仅为 UI 临时态；如在 RegExp UI 勾选 **保存测试文本**，则会把当前规则的测试文本保存到 settings 的 `rule.testText`，下次打开会自动回填。

## 开发

前置条件：

- Node.js 与 npm

安装依赖（如果你本机配置了私有 npm registry，可强制指定公共 registry）：

```bash
npm install --registry https://registry.npmjs.org/
```

构建 Webview：

```bash
cd webview
npm install --registry https://registry.npmjs.org/
npm run build
```

编译扩展：

```bash
npm run compile
```

运行：

- 在 VS Code 中按 `F5` 启动 Extension Development Host 调试。

或使用 dev 脚本（同时启动 TS watch 与 Webview dev server，并在端口占用时提示输入新端口）：

```bash
npm run dev
```

