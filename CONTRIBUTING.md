# Contributing / Development

This document is for **contributors** who clone the repo and build the extension locally. End-user documentation for installing and using the extension is in [README.md](README.md).

## Prerequisites

- Node.js and npm

## Setup

Install dependencies (note: if you have a custom npm registry, force the public registry):

```bash
npm install --registry https://registry.npmjs.org/
```

## Build webview

```bash
cd webview
npm install --registry https://registry.npmjs.org/
npm run build
```

## Compile extension

```bash
npm run compile
```

## Run / debug

- Press `F5` in VS Code to launch the Extension Development Host.

Or use the dev helper (starts TypeScript watch + webview dev server with auto port prompt):

```bash
npm run dev
```

## Tests and coverage

Run `npm run coverage` for all runtime unit and interaction tests. Every included file must reach 95% statements, branches, functions and lines; GitHub Pages CI enforces the same gate before building. Reports are in `coverage/index.html` and `coverage/coverage-summary.json`.

Coverage includes `webview/src`, `src` and `chrome-extension/background.js`. Pure type declarations, test code, generated output and build configuration/scripts are outside runtime coverage. VS Code APIs and Chrome APIs use controlled mocks for deterministic unit tests. `npm run coverage:vscode` generates a separate host report under `coverage/vscode`; `npm run test:vscode` runs the existing real VS Code integration suite and is separate from mocked host coverage.

Run `npm run lint`, `npm run compile`, `npm run compile:test:vscode` and `npx tsc -p webview/tsconfig.json --noEmit` to check lint and types. Build the website with `npm run build:site`, the VS Code webview with `npm run build:webview`, and Chrome extension with `npm run build:chrome`.
