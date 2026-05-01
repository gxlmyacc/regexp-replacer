import * as assert from 'node:assert';
import { applyRule } from '../../../src/replace/engines';
import type { ReplaceRule } from '../../../src/types';

suite('replace engines (vscode)', () => {
  /**
   * 便捷创建规则对象。
   *
   * @param rule 规则片段。
   * @returns 完整规则对象。
   */
  function r(rule: Partial<ReplaceRule>): ReplaceRule {
    return {
      title: rule.title,
      engine: rule.engine ?? 'regex',
      find: rule.find ?? '',
      replace: rule.replace ?? '',
      flags: rule.flags,
      wildcardOptions: rule.wildcardOptions,
      preCommands: rule.preCommands,
      postCommands: rule.postCommands,
    };
  }

  test('regex engine: supports groups and counts', () => {
    const input = 'a1 a2 a3';
    const rule = r({ engine: 'regex', find: 'a(\\d)', replace: 'b$1', flags: 'g' });
    const res = applyRule(input, rule);
    assert.strictEqual(res.text, 'b1 b2 b3');
    assert.strictEqual(res.replacedCount, 3);
  });
});

