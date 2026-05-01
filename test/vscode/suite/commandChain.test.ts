import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { runReplaceInFile, runReplaceInSelection } from '../../../src/replace/replaceRunner';
import type { ReplaceCommand } from '../../../src/types';

suite('command chain execution (vscode)', () => {
  /**
   * 打开一个临时文档并返回编辑器。
   *
   * @param initialText 初始文本。
   * @returns 活动编辑器实例。
   */
  async function openEditor(initialText: string): Promise<vscode.TextEditor> {
    const doc = await vscode.workspace.openTextDocument({ language: 'plaintext', content: initialText });
    return await vscode.window.showTextDocument(doc);
  }

  test('runReplaceInFile: applies pre hook -> rule -> post hook (rule-level)', async () => {
    const editor = await openEditor('a');

    const pre: ReplaceCommand = {
      id: 'pre',
      title: 'pre',
      rules: [{ engine: 'text', find: 'a', replace: 'x', preCommands: [], postCommands: [] }],
    };
    const post: ReplaceCommand = {
      id: 'post',
      title: 'post',
      rules: [{ engine: 'text', find: 'y', replace: 'Z', preCommands: [], postCommands: [] }],
    };
    const main: ReplaceCommand = {
      id: 'main',
      title: 'main',
      rules: [{ engine: 'text', find: 'x', replace: 'y', preCommands: ['pre'], postCommands: ['post'] }],
    };

    await runReplaceInFile(editor, main, [main, pre, post]);
    assert.strictEqual(editor.document.getText(), 'Z');
  });

  test('runReplaceInSelection: executes vscode command when hookId is unknown', async () => {
    const editor = await openEditor('hello');
    editor.selections = [new vscode.Selection(0, 0, 0, 5)];

    let called = false;
    const disposable = vscode.commands.registerCommand('regexpReplacer.__testHook', () => {
      called = true;
    });
    try {
      const main: ReplaceCommand = {
        id: 'main',
        title: 'main',
        rules: [{ engine: 'text', find: 'hello', replace: 'hi', preCommands: ['regexpReplacer.__testHook'], postCommands: [] }],
      };
      await runReplaceInSelection(editor, main, [main]);
      assert.strictEqual(called, true);
      assert.strictEqual(editor.document.getText(), 'hi');
    } finally {
      disposable.dispose();
    }
  });

  test('runReplaceInFile: skips enable=false rules in top-level execution', async () => {
    const editor = await openEditor('a');

    const main: ReplaceCommand = {
      id: 'main',
      title: 'main',
      rules: [
        { engine: 'text', find: 'a', replace: 'x', enable: false, preCommands: [], postCommands: [] },
        { engine: 'text', find: 'x', replace: 'y', preCommands: [], postCommands: [] },
      ],
    };

    await runReplaceInFile(editor, main, [main]);
    assert.strictEqual(editor.document.getText(), 'a');
  });

  test('runReplaceInFile: hook command chain ignores enable filtering', async () => {
    const editor = await openEditor('a');

    const hook: ReplaceCommand = {
      id: 'hook',
      title: 'hook',
      rules: [{ engine: 'text', find: 'a', replace: 'b', enable: false, preCommands: [], postCommands: [] }],
    };
    const main: ReplaceCommand = {
      id: 'main',
      title: 'main',
      rules: [{ engine: 'text', find: 'b', replace: 'c', preCommands: ['hook'], postCommands: [] }],
    };

    await runReplaceInFile(editor, main, [main, hook]);
    assert.strictEqual(editor.document.getText(), 'c');
  });
});

