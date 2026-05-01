import { describe, expect, test } from 'vitest';
import { HookLoopError, applyCommandToText, runHookChainOnText } from '../../src/replace/textChain';

describe('shared textChain (used by webview)', () => {
  test('runHookChainOnText: ignores unknown hookId when configured', () => {
    const text = 'abc';
    const out = runHookChainOnText(text, ['unknown'], [{ id: 'x', title: 'X', rules: [] } as any], {
      ignoreUnknownHookId: true,
      maxDepth: 8,
    });
    expect(out).toBe('abc');
  });

  test('runHookChainOnText: applies hooked command rules', () => {
    const out = runHookChainOnText(
      'foo',
      ['cmd1'],
      [
        {
          id: 'cmd1',
          title: 'C1',
          rules: [{ engine: 'text', find: 'foo', replace: 'bar', preCommands: [], postCommands: [] }],
        } as any,
      ],
      { ignoreUnknownHookId: true, maxDepth: 8 },
    );
    expect(out).toBe('bar');
  });

  test('runHookChainOnText: runs nested pre/post hooks around each rule', () => {
    const cmds = [
      {
        id: 'pre',
        title: 'pre',
        rules: [{ engine: 'text', find: 'a', replace: 'P', preCommands: [], postCommands: [] }],
      },
      {
        id: 'post',
        title: 'post',
        rules: [{ engine: 'text', find: 'x', replace: 'Q', preCommands: [], postCommands: [] }],
      },
      {
        id: 'hook',
        title: 'hook',
        rules: [{ engine: 'text', find: 'P', replace: 'x', preCommands: ['pre'], postCommands: ['post'] }],
      },
    ] as any[];

    const out = runHookChainOnText('a', ['hook'], cmds as any, { ignoreUnknownHookId: true, maxDepth: 8 });
    // a -(pre)-> P -(hook rule)-> x -(post)-> Q
    expect(out).toBe('Q');
  });

  test('runHookChainOnText: maxDepth stops recursion (returns current input)', () => {
    const cmds = [
      {
        id: 'a',
        title: 'A',
        rules: [{ engine: 'text', find: 'x', replace: 'y', preCommands: ['a'], postCommands: [] }],
      },
    ] as any[];
    const out = runHookChainOnText('x', ['a'], cmds as any, { ignoreUnknownHookId: true, maxDepth: 0 });
    // maxDepth=0 会阻止递归的 preCommands，但当前命令本身仍会执行一次规则
    expect(out).toBe('y');
  });

  test('runHookChainOnText: throws HookLoopError on loop', () => {
    const commands = [
      {
        id: 'a',
        title: 'A',
        rules: [{ engine: 'text', find: 'x', replace: 'y', preCommands: ['a'], postCommands: [] }],
      } as any,
    ];

    expect(() =>
      runHookChainOnText('x', ['a'], commands, {
        ignoreUnknownHookId: true,
        maxDepth: 8,
      }),
    ).toThrow(HookLoopError);
  });

  test('applyCommandToText: supports maxRuleIndexInclusive', () => {
    const cmd = {
      id: 'c',
      title: 'C',
      rules: [
        { engine: 'text', find: 'a', replace: 'b' },
        { engine: 'text', find: 'b', replace: 'c' },
      ],
    } as any;

    const full = applyCommandToText('a', cmd);
    expect(full.text).toBe('c');
    expect(full.totalReplacedCount).toBeGreaterThanOrEqual(1);

    const partial = applyCommandToText('a', cmd, { maxRuleIndexInclusive: 0 });
    expect(partial.text).toBe('b');
  });
});

