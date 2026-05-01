import * as vscode from 'vscode';

/** QuickPick 条目：展示文案与要执行的命令 id。 */
interface ReplacerIconPick extends vscode.QuickPickItem {
  readonly commandId: string;
}

/**
 * 弹出与标题栏子菜单一致的操作列表，并在用户选择后执行对应命令。
 *
 * 无入参。
 *
 * @returns 无返回值。
 */
export async function showReplacerIconQuickPick(): Promise<void> {
  const zh = vscode.env.language.toLowerCase().startsWith('zh');
  const items: ReplacerIconPick[] = zh
    ? [
        { label: '在文件中替换', commandId: 'regexpReplacer.replaceInFile' },
        { label: '在选中文本中替换', commandId: 'regexpReplacer.replaceInSelection' },
        { label: 'RegExp UI', commandId: 'regexpReplacer.openRegExpUI' },
      ]
    : [
        { label: 'Replace in File', commandId: 'regexpReplacer.replaceInFile' },
        { label: 'Replace in Selection', commandId: 'regexpReplacer.replaceInSelection' },
        { label: 'RegExp UI', commandId: 'regexpReplacer.openRegExpUI' },
      ];
  const title = zh ? '正则替换器' : 'RegExp Replacer';
  const picked = await vscode.window.showQuickPick(items, { title, canPickMany: false });
  if (picked) {
    await vscode.commands.executeCommand(picked.commandId);
  }
}

/**
 * 解析当前工作区配置中的图标放置方式。
 *
 * @param config `vscode.workspace.getConfiguration()` 返回值。
 * @returns `editor` | `statusBarLeft` | `statusBarRight`。
 */
function readIconPlacement(config: vscode.WorkspaceConfiguration): 'editor' | 'statusBarLeft' | 'statusBarRight' {
  const v = config.get<string>('regexpReplacer.ui.iconPlacement');
  if (v === 'statusBarLeft' || v === 'statusBarRight') {
    return v;
  }
  return 'editor';
}

/**
 * 根据 `showIcon` 与 `iconPlacement` 同步底部状态栏入口：需要时创建/更新并显示，否则隐藏并释放。
 *
 * @param itemRef 保存当前 `StatusBarItem` 引用的可变对象；会在内部替换或清空。
 * @returns 无返回值。
 */
function syncStatusBarItem(itemRef: { current?: vscode.StatusBarItem }): void {
  const config = vscode.workspace.getConfiguration();
  const showIcon = config.get<boolean>('regexpReplacer.ui.showIcon') === true;
  const placement = readIconPlacement(config);
  const wantStatusBar = showIcon && (placement === 'statusBarLeft' || placement === 'statusBarRight');

  if (!wantStatusBar) {
    itemRef.current?.dispose();
    itemRef.current = undefined;
    return;
  }

  const alignment =
    placement === 'statusBarLeft' ? vscode.StatusBarAlignment.Left : vscode.StatusBarAlignment.Right;

  if (itemRef.current && itemRef.current.alignment !== alignment) {
    itemRef.current.dispose();
    itemRef.current = undefined;
  }

  if (!itemRef.current) {
    itemRef.current = vscode.window.createStatusBarItem('regexpReplacer.iconActions', alignment, 100);
    itemRef.current.command = 'regexpReplacer.showIconMenu';
  }

  const zh = vscode.env.language.toLowerCase().startsWith('zh');
  itemRef.current.text = '$(replace-all)';
  itemRef.current.name = zh ? '正则替换器' : 'RegExp Replacer';
  itemRef.current.tooltip = zh ? '正则替换器：在文件中替换、在选中文本中替换、RegExp UI' : 'RegExp Replacer: Replace in File, Selection, RegExp UI';
  itemRef.current.show();
}

/**
 * 注册状态栏图标同步逻辑与「展示快捷菜单」命令，并监听相关配置变更。
 *
 * @param context VS Code 扩展上下文，用于纳入 `subscriptions` 生命周期。
 * @returns 无返回值。
 */
export function registerPlacementIconUi(context: vscode.ExtensionContext): void {
  const itemRef: { current?: vscode.StatusBarItem } = {};

  context.subscriptions.push(
    vscode.commands.registerCommand('regexpReplacer.showIconMenu', () => showReplacerIconQuickPick()),
  );

  const refresh = (): void => {
    syncStatusBarItem(itemRef);
  };

  refresh();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('regexpReplacer.ui.showIcon') ||
        e.affectsConfiguration('regexpReplacer.ui.iconPlacement')
      ) {
        refresh();
      }
    }),
  );

  context.subscriptions.push({
    dispose(): void {
      itemRef.current?.dispose();
      itemRef.current = undefined;
    },
  });
}
