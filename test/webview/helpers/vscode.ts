import { vi } from 'vitest';

/** VS Code 宿主边界替身；用例通过调用参数验证业务行为，而不是启动真实编辑器。 */
export const workspace = {
  getConfiguration: vi.fn(), onDidChangeConfiguration: vi.fn(),
  fs: { readFile: vi.fn(), writeFile: vi.fn() }, workspaceFolders: undefined,
};
export const window = {
  activeTextEditor: undefined,
  showQuickPick: vi.fn(), showWarningMessage: vi.fn(), showInformationMessage: vi.fn(), showErrorMessage: vi.fn(),
  createStatusBarItem: vi.fn(), createWebviewPanel: vi.fn(), showOpenDialog: vi.fn(), showSaveDialog: vi.fn(),
};
export const commands = { registerCommand: vi.fn(), executeCommand: vi.fn() };
export const env = { language: 'en' };
export const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 };
export const StatusBarAlignment = { Left: 1, Right: 2 };
export const ViewColumn = { One: 1, Beside: 2 };
export const ExtensionMode = { Production: 1, Development: 2, Test: 3 };
export const Uri = {
  file: vi.fn((path: string) => ({ fsPath: path, toString: () => path })),
  parse: vi.fn((path: string) => ({ fsPath: path, toString: () => path })),
  joinPath: vi.fn((base: { fsPath: string }, ...parts: string[]) => Uri.file([base.fsPath, ...parts].join('/'))),
};
export class Position {
  constructor(public line: number, public character: number) {}
}
export class Range {
  constructor(public start: Position, public end: Position) {}
}
