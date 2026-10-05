import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as vscode from 'vscode';
import { RegExpUiPanel } from '../../src/webview/regExpUiPanel';

vi.mock('fs', () => ({ readFileSync: vi.fn() }));
import * as fs from 'fs';
const api = vscode as unknown as typeof import('./helpers/vscode');
let panel: any;
let receive: (message: unknown) => Promise<void>;
let dispose: () => void;
let context: vscode.ExtensionContext;
const commands = [{ id: 'one', title: 'One', rules: [] }];

beforeEach(() => {
  vi.clearAllMocks();
  RegExpUiPanel.currentPanel = undefined;
  api.env.language = 'en';
  api.window.activeTextEditor = undefined;
  api.workspace.workspaceFolders = undefined;
  api.workspace.getConfiguration.mockReturnValue({ get: vi.fn().mockReturnValue([]), update: vi.fn() });
  vi.mocked(fs.readFileSync).mockReturnValue('<script src="/assets/ui.js"></script><link href="/assets/ui.css">');
  panel = { reveal: vi.fn(), onDidDispose: vi.fn((callback) => { dispose = callback; }), webview: {
    cspSource: 'vscode-resource:', asWebviewUri: (uri: unknown) => String(uri), postMessage: vi.fn(),
    onDidReceiveMessage: (callback: typeof receive) => { receive = callback; },
  } };
  api.window.createWebviewPanel.mockReturnValue(panel);
  context = { extensionUri: vscode.Uri.file('/extension'), extensionMode: vscode.ExtensionMode.Production } as vscode.ExtensionContext;
});
afterEach(() => { RegExpUiPanel.currentPanel = undefined; vi.unstubAllEnvs(); });

describe('webview panel host contract', () => {
  test('build entry resources, reveal the existing panel, dispose and rebuild', () => {
    RegExpUiPanel.show(context);
    expect(panel.webview.html).toContain('/dist-webview/assets/ui.js');
    expect(panel.webview.html).toContain('Content-Security-Policy');
    RegExpUiPanel.show(context);
    expect(api.window.createWebviewPanel).toHaveBeenCalledOnce();
    expect(panel.reveal).toHaveBeenCalledWith(vscode.ViewColumn.One);
    dispose();
    api.window.activeTextEditor = { viewColumn: 3 } as any;
    RegExpUiPanel.show(context);
    expect(api.window.createWebviewPanel.mock.calls[1][2]).toBe(3);
  });
  test.each([new Error('<error>&"\''), 'plain failure', null])('resource errors produce escaped diagnostics: %s', (error) => {
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw error; });
    RegExpUiPanel.show(context);
    expect(panel.webview.html).toContain('RegExp UI 加载失败');
    if (error instanceof Error) expect(panel.webview.html).toContain('&lt;error&gt;&amp;&quot;&#39;');
  });
  test('invalid entry HTML shows build instructions', () => {
    vi.mocked(fs.readFileSync).mockReturnValue('<script></script>');
    RegExpUiPanel.show(context);
    expect(panel.webview.html).toContain('无法从 Vite 构建产物');
  });
  test.each(['context', 'environment'])('development mode %s uses the configured server', (mode) => {
    if (mode === 'context') context = { ...context, extensionMode: vscode.ExtensionMode.Development };
    else vi.stubEnv('REGEXP_REPLACER_WEBVIEW_DEV', '1');
    if (mode === 'environment') vi.stubEnv('REGEXP_REPLACER_WEBVIEW_DEV_ORIGIN', 'http://localhost:6000');
    RegExpUiPanel.show(context);
    expect(panel.webview.html).toContain(mode === 'context' ? 'http://localhost:5173/src/main.tsx' : 'http://localhost:6000/src/main.tsx');
  });
  test('workspace commands migrate to global once; updates remove workspace overrides', async () => {
    const get = vi.fn().mockReturnValueOnce([]).mockReturnValueOnce(commands).mockReturnValue(commands);
    const update = vi.fn();
    api.workspace.getConfiguration.mockReturnValue({ get, update });
    RegExpUiPanel.show(context);
    await receive({ type: 'getConfig' });
    expect(update).toHaveBeenCalledWith('commands', commands, true);
    expect(update).toHaveBeenCalledWith('commands', undefined, false);
    update.mockClear();
    await receive({ type: 'getConfig' });
    expect(update).not.toHaveBeenCalled();
    await receive({ type: 'setConfig', payload: commands });
    expect(update).toHaveBeenCalledWith('commands', commands, true);
    await receive({ type: 'setConfig', payload: null });
    expect(update).toHaveBeenCalledWith('commands', [], true);
    expect(panel.webview.postMessage).toHaveBeenLastCalledWith({ type: 'config', payload: commands });
  });
  test('global commands take precedence and an empty workspace is not migrated', async () => {
    const update = vi.fn();
    api.workspace.getConfiguration.mockReturnValue({ get: vi.fn().mockReturnValue(commands), update });
    RegExpUiPanel.show(context);
    await receive({ type: 'getConfig' });
    expect(update).not.toHaveBeenCalled();
    dispose();
    api.workspace.getConfiguration.mockReturnValue({ get: vi.fn().mockReturnValue([]), update });
    RegExpUiPanel.show(context);
    await receive({ type: 'getConfig' });
    expect(update).not.toHaveBeenCalled();
  });
  test('export supports cancellation, browser language and both default locations', async () => {
    RegExpUiPanel.show(context);
    api.window.showSaveDialog.mockResolvedValueOnce(undefined).mockResolvedValue(vscode.Uri.file('/out.json'));
    await receive({ type: 'exportCommands' });
    expect(api.workspace.fs.writeFile).not.toHaveBeenCalled();
    api.env.language = 'zh-cn';
    api.workspace.workspaceFolders = [{ uri: vscode.Uri.file('/workspace') }] as any;
    await receive({ type: 'exportCommands', payload: commands });
    expect(api.workspace.fs.writeFile.mock.calls[0][1].toString()).toBe(JSON.stringify(commands, null, 2));
    expect(api.window.showSaveDialog.mock.calls[1][0].defaultUri.fsPath).toBe('/workspace/regexp-replacer.commands.json');
    expect(api.window.showInformationMessage).toHaveBeenCalledWith('导出成功。');
  });
  test('import rejects invalid JSON, non arrays and cancellation, then saves a valid file', async () => {
    RegExpUiPanel.show(context);
    api.window.showOpenDialog.mockResolvedValueOnce(undefined).mockResolvedValueOnce([]).mockResolvedValue([vscode.Uri.file('/in.json')]);
    await receive({ type: 'importCommands' }); await receive({ type: 'importCommands' });
    expect(api.workspace.fs.readFile).not.toHaveBeenCalled();
    api.workspace.fs.readFile.mockResolvedValueOnce(Buffer.from('{')).mockResolvedValueOnce(Buffer.from('{}')).mockResolvedValueOnce(Buffer.from(JSON.stringify(commands)));
    await receive({ type: 'importCommands' }); await receive({ type: 'importCommands' });
    expect(api.window.showErrorMessage).toHaveBeenCalledTimes(2);
    await receive({ type: 'importCommands' });
    expect(api.window.showInformationMessage).toHaveBeenCalledWith('Imported.');
  });
  test('language and messages preserve explicit text and localize fallback text; invalid messages are ignored', async () => {
    RegExpUiPanel.show(context);
    for (const input of [null, 'bad', {}, { type: 'unknown' }]) await receive(input);
    expect(panel.webview.postMessage).not.toHaveBeenCalled();
    await receive({ type: 'getLanguage' });
    expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'language', payload: { language: 'en' } });
    for (const type of ['showError', 'showInfo']) {
      await receive({ type, payload: { message: 'explicit' } });
      await receive({ type });
    }
    expect(api.window.showErrorMessage).toHaveBeenCalledWith('explicit');
    expect(api.window.showErrorMessage).toHaveBeenCalledWith('Unknown error');
    expect(api.window.showInformationMessage).toHaveBeenCalledWith('Info');
    api.env.language = undefined as any;
    await receive({ type: 'getLanguage' });
  });
});
