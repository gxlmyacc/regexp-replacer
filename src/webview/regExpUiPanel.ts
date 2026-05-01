import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import { clearConfiguredCommands, getConfiguredCommands, setConfiguredCommands } from '../config';

/**
 * RegExp UI Webview 面板封装，用于展示命令管理与规则测试页面。
 */
export class RegExpUiPanel {
  public static currentPanel: RegExpUiPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private didTryMigrateToGlobal = false;

  /**
   * 创建或显示面板实例。
   *
   * @param context 扩展上下文。
   * @returns 无返回值。
   */
  public static show(context: vscode.ExtensionContext): void {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (RegExpUiPanel.currentPanel) {
      RegExpUiPanel.currentPanel.panel.reveal(column);
      return;
    }

    const isDev = isWebviewDevMode(context);
    const panel = vscode.window.createWebviewPanel(
      'regexpReplacer.regExpUi',
      'RegExp UI',
      column,
      {
        enableScripts: true,
        localResourceRoots: isDev
          ? [context.extensionUri]
          : [vscode.Uri.joinPath(context.extensionUri, 'dist-webview'), vscode.Uri.joinPath(context.extensionUri, 'icon')],
      },
    );

    RegExpUiPanel.currentPanel = new RegExpUiPanel(panel, context.extensionUri, context);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview, context);

    this.panel.onDidDispose(() => {
      RegExpUiPanel.currentPanel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(async (message: unknown) => {
      await this.handleMessage(context, message);
    });
  }

  /**
   * 处理 Webview 发来的消息。
   *
   * @param context 扩展上下文。
   * @param message 消息对象。
   * @returns 无返回值。
   */
  private async handleMessage(context: vscode.ExtensionContext, message: unknown): Promise<void> {
    if (!message || typeof message !== 'object') return;
    const msg = message as { type?: string; payload?: unknown };
    const ui = getExtensionUiStrings();

    if (msg.type === 'getConfig') {
      const commands = await this.getCommandsWithGlobalMigration();
      this.panel.webview.postMessage({ type: 'config', payload: commands });
      return;
    }

    if (msg.type === 'setConfig') {
      const commands = Array.isArray(msg.payload) ? msg.payload : [];
      await setConfiguredCommands(commands as any, vscode.ConfigurationTarget.Global);
      // 清理工作区覆盖，避免全局保存后仍被工作区旧值遮住
      await clearConfiguredCommands(vscode.ConfigurationTarget.Workspace);
      this.panel.webview.postMessage({ type: 'config', payload: await this.getCommandsWithGlobalMigration() });
      return;
    }

    if (msg.type === 'exportCommands') {
      const commands = Array.isArray(msg.payload) ? msg.payload : [];
      const uri = await vscode.window.showSaveDialog({
        filters: { JSON: ['json'] },
        saveLabel: ui.export,
        defaultUri: getDefaultExportUri('regexp-replacer.commands.json'),
      });
      if (!uri) return;
      const buf = Buffer.from(JSON.stringify(commands, null, 2), 'utf8');
      await vscode.workspace.fs.writeFile(uri, buf);
      await vscode.window.showInformationMessage(ui.exportOk);
      return;
    }

    if (msg.type === 'importCommands') {
      const picked = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { JSON: ['json'] },
        openLabel: ui.import,
      });
      const uri = picked?.[0];
      if (!uri) return;
      const raw = await vscode.workspace.fs.readFile(uri);
      let parsed: unknown;
      try {
        parsed = JSON.parse(Buffer.from(raw).toString('utf8'));
      } catch {
        await vscode.window.showErrorMessage(ui.invalidJson);
        return;
      }
      if (!Array.isArray(parsed)) {
        await vscode.window.showErrorMessage(ui.invalidJson);
        return;
      }
      await setConfiguredCommands(parsed as any, vscode.ConfigurationTarget.Global);
      await clearConfiguredCommands(vscode.ConfigurationTarget.Workspace);
      this.panel.webview.postMessage({ type: 'config', payload: await this.getCommandsWithGlobalMigration() });
      await vscode.window.showInformationMessage(ui.importOk);
      return;
    }

    if (msg.type === 'getLanguage') {
      this.panel.webview.postMessage({ type: 'language', payload: { language: vscode.env.language } });
      return;
    }

    if (msg.type === 'showError') {
      const messageText = (msg.payload as any)?.message;
      await vscode.window.showErrorMessage(typeof messageText === 'string' ? messageText : ui.unknownError);
      return;
    }

    if (msg.type === 'showInfo') {
      const messageText = (msg.payload as any)?.message;
      await vscode.window.showInformationMessage(typeof messageText === 'string' ? messageText : ui.info);
    }
  }

  /**
   * 生成 Webview HTML，并加载 Vite 构建产物。
   *
   * @param webview Webview 实例。
   * @param context 扩展上下文。
   * @returns HTML 字符串。
   */
  private getHtmlForWebview(webview: vscode.Webview, context: vscode.ExtensionContext): string {
    const faviconUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'icon', 'favicon.png'));
    if (isWebviewDevMode(context)) {
      return getDevHtmlForWebview(webview, faviconUri);
    }
    const distRoot = vscode.Uri.joinPath(this.extensionUri, 'dist-webview');
    const nonce = getNonce();

    try {
      const { scriptFile, styleFile } = readViteEntryFiles(distRoot.fsPath);
      const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distRoot, 'assets', scriptFile));
      const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(distRoot, 'assets', styleFile));

      const csp = [
        `default-src 'none'`,
        `img-src ${webview.cspSource} https: data:`,
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `script-src 'nonce-${nonce}' ${webview.cspSource}`,
        `font-src ${webview.cspSource}`,
      ].join('; ');

      return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="${faviconUri}">
    <link rel="stylesheet" href="${styleUri}">
    <title>RegExp UI</title>
  </head>
  <body>
    <div id="root">正在加载 RegExp UI…</div>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
  </body>
</html>`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const csp = [
        `default-src 'none'`,
        `img-src ${webview.cspSource} https: data:`,
        `style-src ${webview.cspSource} 'unsafe-inline'`,
        `font-src ${webview.cspSource}`,
      ].join('; ');
      return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="${faviconUri}">
    <title>RegExp UI</title>
    <style>
      body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
      .box { padding: 16px; line-height: 1.6; }
      code { font-family: var(--vscode-editor-font-family); }
      pre { white-space: pre-wrap; word-break: break-word; background: rgba(127,127,127,0.08); padding: 12px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <div class="box">
      <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">RegExp UI 加载失败</div>
      <div style="opacity: .85; margin-bottom: 8px;">看起来 Webview 的前端构建产物缺失或无法读取。</div>
      <div style="margin-bottom: 8px;">请先在仓库根目录执行：</div>
      <pre><code>npm run build:webview</code></pre>
      <div style="margin-bottom: 8px;">如果你是在调试模式（F5）打开面板，还需要先启动 dev server：</div>
      <pre><code>npm run dev:webview</code></pre>
      <div style="margin-top: 12px; opacity: .8;">错误信息：</div>
      <pre><code>${escapeHtml(msg)}</code></pre>
    </div>
  </body>
</html>`;
    }
  }

  /**
   * 获取命令配置，并在必要时将“工作区存量命令”迁移到全局设置。
   *
   * @returns 命令列表（优先全局；若需要则自动迁移工作区到全局）。
   */
  private async getCommandsWithGlobalMigration(): Promise<unknown[]> {
    // 只尝试一次，避免频繁 I/O
    if (this.didTryMigrateToGlobal) return getConfiguredCommands();
    this.didTryMigrateToGlobal = true;

    const globalCommands = getConfiguredCommands(vscode.ConfigurationTarget.Global);
    const workspaceCommands = getConfiguredCommands(vscode.ConfigurationTarget.Workspace);

    // 若全局为空但工作区有历史存量，则自动迁移到全局，并清除工作区覆盖
    if (globalCommands.length === 0 && workspaceCommands.length > 0) {
      await setConfiguredCommands(workspaceCommands, vscode.ConfigurationTarget.Global);
      await clearConfiguredCommands(vscode.ConfigurationTarget.Workspace);
    }

    return getConfiguredCommands();
  }
}

/**
 * 生成导出命令的默认保存位置与文件名。
 *
 * @param fileName 默认文件名。
 * @returns 建议的默认保存 Uri。
 */
function getDefaultExportUri(fileName: string): vscode.Uri {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (folder) return vscode.Uri.joinPath(folder, fileName);
  return vscode.Uri.joinPath(vscode.Uri.file(os.homedir()), fileName);
}

type ExtensionUiStrings = {
  export: string;
  import: string;
  exportOk: string;
  importOk: string;
  invalidJson: string;
  unknownError: string;
  info: string;
};

/**
 * 获取扩展侧（非 Webview）UI 文案（依据 VS Code 语言环境）。
 *
 * @returns 文案对象。
 */
function getExtensionUiStrings(): ExtensionUiStrings {
  const lang = (vscode.env.language ?? '').toLowerCase();
  const isZh = lang.startsWith('zh');
  return isZh
    ? {
        export: '导出',
        import: '导入',
        exportOk: '导出成功。',
        importOk: '导入成功。',
        invalidJson: 'JSON 文件格式不正确。',
        unknownError: '未知错误',
        info: '提示',
      }
    : {
        export: 'Export',
        import: 'Import',
        exportOk: 'Exported.',
        importOk: 'Imported.',
        invalidJson: 'Invalid JSON.',
        unknownError: 'Unknown error',
        info: 'Info',
      };
}

type ViteEntryFiles = {
  scriptFile: string;
  styleFile: string;
};

/**
 * 判断是否启用 Webview 开发模式（用于调试时直接加载 Vite Dev Server）。
 *
 * @param context 扩展上下文。
 * @returns 是否为开发模式。
 */
function isWebviewDevMode(context: vscode.ExtensionContext): boolean {
  return context.extensionMode === vscode.ExtensionMode.Development || process.env.REGEXP_REPLACER_WEBVIEW_DEV === '1';
}

/**
 * 生成开发模式 Webview HTML（加载本地 Vite Dev Server）。
 *
 * @param webview Webview 实例。
 * @param faviconUri favicon 资源地址。
 * @returns HTML 字符串。
 */
function getDevHtmlForWebview(webview: vscode.Webview, faviconUri: vscode.Uri): string {
  const devServerOrigin = process.env.REGEXP_REPLACER_WEBVIEW_DEV_ORIGIN || 'http://localhost:5173';
  const nonce = getNonce();

  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} https: data: ${devServerOrigin}`,
    `style-src ${webview.cspSource} 'unsafe-inline' ${devServerOrigin}`,
    // Vite HMR 需要 eval；仅用于开发模式
    `script-src 'nonce-${nonce}' 'unsafe-eval' ${webview.cspSource} ${devServerOrigin}`,
    `font-src ${webview.cspSource} ${devServerOrigin}`,
    `connect-src ${webview.cspSource} ${devServerOrigin} ws://localhost:5173`,
  ].join('; ');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="${faviconUri}">
    <title>RegExp UI (dev)</title>
  </head>
  <body>
    <div id="root" style="padding: 12px; opacity: .85;">
      正在从 <code>${devServerOrigin}</code> 加载 RegExp UI（dev）…<br />
      如果长时间空白，请先运行：<code>npm run dev:webview</code>
    </div>
    <script nonce="${nonce}" type="module" src="${devServerOrigin}/src/main.tsx"></script>
  </body>
</html>`;
}

/**
 * 转义 HTML，避免错误信息破坏页面结构。
 *
 * @param s 原始文本。
 * @returns 转义后的文本。
 */
function escapeHtml(s: string): string {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * 从 Vite 构建产物中读取入口脚本与样式文件名。
 *
 * @param distRootFsPath Vite 构建输出目录的文件系统路径。
 * @returns 入口脚本与样式文件名。
 */
function readViteEntryFiles(distRootFsPath: string): ViteEntryFiles {
  // Vite 默认会生成 dist/index.html，其中引用带 hash 的 /assets/*.js 与 /assets/*.css
  const htmlPath = vscode.Uri.joinPath(vscode.Uri.file(distRootFsPath), 'index.html').fsPath;
  const html = fs.readFileSync(htmlPath, 'utf8');

  const scriptMatch = html.match(/<script[^>]+src="\/assets\/([^"]+\.js)"/i);
  const styleMatch = html.match(/<link[^>]+href="\/assets\/([^"]+\.css)"/i);

  if (!scriptMatch || !styleMatch) {
    throw new Error('无法从 Vite 构建产物 index.html 解析入口资源，请先运行 webview 构建。');
  }

  return { scriptFile: scriptMatch[1], styleFile: styleMatch[1] };
}

/**
 * 生成 CSP nonce。
 *
 * @returns nonce 字符串。
 */
function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

