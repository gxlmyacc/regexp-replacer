# RegExp Replacer (VS Code Extension)

Reusable **regex / text / wildcard** replacement commands for VS Code.

## Features

- **Replace in File**: run a configured replacement command on the active editor document.
- **Replace in Selection**: run a configured replacement command on the current selection(s).
- **RegExp UI**: open a webview to manage/create/edit commands and test rules.
- **Command hooks**: run VS Code command ids before/after a replacement command.
- **Import / Export (RegExp UI)**: import/export commands as JSON files.
- **Resizable layout (RegExp UI)**: drag splitters to resize the left command list and the bottom tools dock.
- **Optional icon / menu**: show a quick entry (editor title bar or status bar left/right); click for the same actions (Replace in File, Replace in Selection, RegExp UI). Editor placement uses a submenu; status bar uses QuickPick.

## Configuration

Commands are stored in VS Code settings under:

- `regexpReplacer.commands`: `ReplaceCommand[]`
- `regexpReplacer.ui.showIcon`: `boolean` (show the quick entry when enabled)
- `regexpReplacer.ui.iconPlacement`: `editor | statusBarLeft | statusBarRight` (default: `editor`; status bar opens a quick pick on click)

Each command can contain multiple rules executed in order:

- `enable` (optional): `boolean` (default: `true`). If `false`, the rule is skipped in **Replace in File / Replace in Selection**.
- `engine`: `regex | text | wildcard`
- `find`: pattern string
- `replace`: replacement template (JavaScript `String.replace` syntax, e.g. `$1`, `$&`, `$$`)
- `replaceMode` (optional): `template | map` (default: `template`)
- `map` (optional): `{ mode: "text" | "regex", cases: Array<{ find: string, replace: string }> }` (only used when `replaceMode` is `map`)
- `flags` (regex only): `g i m s u y d`
- `wildcardOptions.dotAll` (wildcard only): allow `*` / `?` to match newline

### Replace mode: `map`

In **map** mode, the rule will:

- First match fragments using the main rule (`find` + `flags`).
- Then apply `map.cases` to **capture groups only** (`$1..$n`, in order). It scans the table **top to bottom** and applies **only the first rule that matches** for the first matching group, then writes the result back into the fragment:
  - `map.mode="text"`: literal (text) global replacement on the group text
  - `map.mode="regex"`: regex global replacement on the group text (table regex flags are fixed to `g`)
- `map` mode only supports `engine: "regex"`.
- `replace` in each case item uses the same replacement template logic as normal replace (supports `\\n`, `\\t`, `\\\\`, and `$&`, `$1..$99`, `$$`, `$<name>`).

### `settings.json` format example

Below is an example you can paste into VS Code `settings.json`.

```json
{
  "regexpReplacer.commands": [
    {
      "id": "demo-text",
      "title": "Demo: Text replace",
      "description": "Replace a literal substring",
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
      "title": "Demo: Regex replace",
      "rules": [
        {
          "engine": "regex",
          "find": "(\\d+)",
          "replace": "Number($1)",
          "flags": "gim",
          "preCommands": ["demo-text"],
          "postCommands": []
        },
        {
          "engine": "wildcard",
          "find": "hello*world\\n?",
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

Notes:

- **Replacement template**: uses JavaScript `String.replace` templates (e.g. `$1`, `$&`, `$'`, `$$`).
- **Wildcard engine**: supports glob-like `*` / `?` and `\\n`. Use `wildcardOptions.dotAll=true` if you want `*` / `?` to match newline.
- **Rule enable**:
  - If a command has **all rules disabled**, it is hidden from the IDE command picker (QuickPick).
  - Hook chains triggered via `preCommands` / `postCommands` are **not filtered by `enable`**.
- **Hooks (`preCommands` / `postCommands`)**:
  - At **command level**: list of VS Code command ids or other configured command ids (for chaining).
  - At **rule level** (optional): supported by RegExp UI for per-rule setup. The extension will execute rule hooks **before/after each rule** (and falls back to command-level hooks when rule hooks are not set).
  - If a **loop is detected** in the command chain during execution, the extension will **abort** and show an error to prevent hanging.

## RegExp UI notes

- The command list always keeps a top **Untitled command** draft for quick creation (it is not saved if left pristine).
- UI-only states (temporary template input, active tools tab, etc.) are cached per (command + rule) for convenience and are **not** written into settings.
- Test text is UI-only by default. If you enable **Save test text** in RegExp UI, it will be saved to settings as `rule.testText` and restored next time.

## Development

Prerequisites:

- Node.js and npm

Install dependencies (note: if you have a custom npm registry, force the public registry):

```bash
npm install --registry https://registry.npmjs.org/
```

Build webview:

```bash
cd webview
npm install --registry https://registry.npmjs.org/
npm run build
```

Compile extension:

```bash
npm run compile
```

Run:

- Press `F5` in VS Code to launch the Extension Development Host.

Or use the dev helper (starts TypeScript watch + webview dev server with auto port prompt):

```bash
npm run dev
```

