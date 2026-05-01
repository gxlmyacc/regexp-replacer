import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { HookLoopError, runReplaceInFile } from '../../../src/replace/replaceRunner';
import type { ReplaceCommand } from '../../../src/types';

suite('hook loop detection (vscode)', () => {
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

  test('throws HookLoopError when hooks form a cycle', async () => {
    const editor = await openEditor('hello');

    const cmdA: ReplaceCommand = {
      id: 'A',
      title: 'A',
      rules: [{ engine: 'text', find: 'h', replace: 'H', preCommands: ['B'] }],
    };
    const cmdB: ReplaceCommand = {
      id: 'B',
      title: 'B',
      rules: [{ engine: 'text', find: 'e', replace: 'E', preCommands: ['A'] }],
    };

    let threw = false;
    try {
      await runReplaceInFile(editor, cmdA, [cmdA, cmdB]);
    } catch (e) {
      threw = true;
      // 扩展宿主环境下可能会加载到不同模块实例，导致 instanceof 不稳定；这里用语义断言更可靠
      const anyErr = e as any;
      assert.strictEqual(anyErr?.name, 'HookLoopError');
      assert.ok(Array.isArray(anyErr?.chain));
      assert.ok(String(anyErr.chain.join(' -> ')).includes('A'));
    }
    assert.strictEqual(threw, true);
  });
});

