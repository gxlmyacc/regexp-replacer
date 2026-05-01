import { describe, expect, test } from 'vitest';
import { getSelectedRuleHooks, wouldCreateLoop } from '../../webview/src/features/hooks/hookUtils';

describe('webview hookUtils (rule-level only)', () => {
  test('getSelectedRuleHooks: returns rule pre/post only', () => {
    const cmd = {
      id: 'a',
      title: 'A',
      // @ts-expect-error: ensure command-level hooks are ignored in typing/logic
      preCommands: ['x'],
      // @ts-expect-error: ensure command-level hooks are ignored in typing/logic
      postCommands: ['y'],
      rules: [{ preCommands: ['b'], postCommands: ['c'] }],
    };

    expect(getSelectedRuleHooks(cmd, 0, 'pre')).toEqual(['b']);
    expect(getSelectedRuleHooks(cmd, 0, 'post')).toEqual(['c']);
  });

  test('wouldCreateLoop: detects loops using rule hooks graph', () => {
    const saved = [
      { id: 'a', title: 'A', rules: [{ preCommands: ['b'] }] },
      { id: 'b', title: 'B', rules: [{ preCommands: ['c'] }] },
      { id: 'c', title: 'C', rules: [{ preCommands: [] }] },
    ];

    // adding c -> a would create a cycle: c -> a -> b -> c
    expect(wouldCreateLoop(saved, 'c', 'a')).toBe(true);
    // adding a -> c does not create a cycle because path c -> ... does not reach a
    expect(wouldCreateLoop(saved, 'a', 'c')).toBe(false);
  });
});

