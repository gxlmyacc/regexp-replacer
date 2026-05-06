import * as assert from 'node:assert';
import { applyRule, expandReplacementTemplate } from '../replace/engines';
import type { ReplaceRule } from '../types';

suite('node unit: engines', () => {
  /**
   * 便捷创建规则对象。
   *
   * @param rule 规则片段。
   * @returns 完整规则对象。
   */
  function r(rule: Partial<ReplaceRule>): ReplaceRule {
    return {
      title: rule.title,
      replaceMode: rule.replaceMode,
      engine: rule.engine ?? 'regex',
      find: rule.find ?? '',
      replace: rule.replace ?? '',
      map: rule.map,
      flags: rule.flags,
      wildcardOptions: rule.wildcardOptions,
      preCommands: rule.preCommands,
      postCommands: rule.postCommands,
    };
  }

  test('regex: groups and count', () => {
    const input = 'a1 a2 a3';
    const res = applyRule(input, r({ engine: 'regex', find: 'a(\\d)', replace: 'b$1', flags: 'g' }));
    assert.strictEqual(res.text, 'b1 b2 b3');
    assert.strictEqual(res.replacedCount, 3);
  });

  test('text: empty find is no-op', () => {
    const input = 'abc';
    const res = applyRule(input, r({ engine: 'text', find: '', replace: 'x' }));
    assert.strictEqual(res.text, 'abc');
    assert.strictEqual(res.replacedCount, 0);
  });

  test('wildcard: dotAll option affects \\n matching', () => {
    const input = 'ab\ncd';
    const res1 = applyRule(input, r({ engine: 'wildcard', find: 'a*', replace: 'Z' }));
    assert.strictEqual(res1.replacedCount, 1);
    assert.strictEqual(res1.text, 'Z\ncd');

    const res2 = applyRule(
      input,
      r({ engine: 'wildcard', find: 'a*', replace: 'Z', wildcardOptions: { dotAll: true } }),
    );
    assert.strictEqual(res2.replacedCount, 1);
    assert.strictEqual(res2.text, 'Z');
  });

  test('regex map: first matching row wins; later rows do not run on same fragment', () => {
    const input = 'AB';
    const rule = r({
      engine: 'regex',
      find: '(AB)',
      flags: 'g',
      replaceMode: 'map',
      map: {
        mode: 'text',
        cases: [
          { find: 'A', replace: 'X' },
          { find: 'B', replace: 'Y' },
        ],
      },
      replace: 'unused',
    });
    const res = applyRule(input, rule);
    assert.strictEqual(res.text, 'XB');
    assert.strictEqual(res.replacedCount, 1);
  });

  test('regex map: applies cases replacements within main match fragments', () => {
    const input = 'x=A; x=B; x=C;';
    const rule = r({
      engine: 'regex',
      find: 'x=([A-Z])',
      flags: 'g',
      replaceMode: 'map',
      map: {
        mode: 'text',
        cases: [
          { find: 'A', replace: 'AA' },
          { find: 'C', replace: 'CC' },
        ],
      },
      replace: 'unused',
    });
    const res = applyRule(input, rule);
    assert.strictEqual(res.text, 'x=AA; x=B; x=CC;');
    // 只有发生变化的片段才计数
    assert.strictEqual(res.replacedCount, 2);
  });

  test('regex map: uses rule.flags for main matching, and cases regex flags are fixed to g', () => {
    const input = 'x=A; x=a;';
    const rule = r({
      engine: 'regex',
      find: 'x=([a-z])',
      flags: 'gi', // 主匹配应命中 A 与 a
      replaceMode: 'map',
      map: {
        mode: 'regex',
        // cases 内 flags 固定 g（不含 i），因此只会把小写 a 替换成 A
        cases: [{ find: 'a', replace: 'A' }],
      },
      replace: 'unused',
    });
    const res = applyRule(input, rule);
    assert.strictEqual(res.text, 'x=A; x=A;');
    assert.strictEqual(res.replacedCount, 1);
  });

  test('regex map: regex mode supports replacement template escapes and tokens', () => {
    const input = 'x=12;';
    const rule = r({
      engine: 'regex',
      find: 'x=(\\d+)',
      flags: 'g',
      replaceMode: 'map',
      map: {
        mode: 'regex',
        cases: [{ find: '(\\d+)', replace: 'N($1)\\n' }],
      },
      replace: 'unused',
    });
    const res = applyRule(input, rule);
    assert.strictEqual(res.text, 'x=N(12)\n;');
    assert.strictEqual(res.replacedCount, 1);
  });

  test('regex map: invalid config throws (empty cases)', () => {
    assert.throws(() => {
      applyRule(
        'x=A;',
        r({
          engine: 'regex',
          find: 'x=(A)',
          replace: '',
          flags: 'g',
          replaceMode: 'map',
          map: { mode: 'text', cases: [] },
        }),
      );
    });
  });

  test('template: $& $` $\' $$ $1', () => {
    const out = expandReplacementTemplate('[$&|$`|$\'|$$|$1]', {
      match: 'b',
      groups: ['X'],
      offset: 1,
      input: 'abc',
    });
    assert.strictEqual(out, '[b|a|c|$|X]');
  });

  test('template: 仅 1 个捕获组时 $133 按 $1 展开后保留后续数字', () => {
    const out = expandReplacementTemplate('$133', {
      match: 'x',
      groups: ['a'],
      offset: 0,
      input: 'x',
    });
    assert.strictEqual(out, 'a33');
  });

  test('template: $<name> 从 namedGroups 取值；未知组名为空', () => {
    assert.strictEqual(
      expandReplacementTemplate('p=$<id>', {
        match: 'm',
        groups: ['1'],
        offset: 0,
        input: 'm',
        namedGroups: { id: '42' },
      }),
      'p=42',
    );
    assert.strictEqual(
      expandReplacementTemplate('[$<missing>]', {
        match: 'm',
        groups: ['x'],
        offset: 0,
        input: 'm',
        namedGroups: { id: '42' },
      }),
      '[]',
    );
  });

  test('regex: 命名捕获在替换中用 $<name> 展开', () => {
    const res = applyRule('v=12;', r({ engine: 'regex', find: 'v=(?<id>\\d+)', replace: '[$<id>]', flags: 'g' }));
    assert.strictEqual(res.text, '[12];');
    assert.strictEqual(res.replacedCount, 1);
  });

  test('regex: 命名与编号捕获并存时 $<letter> 与 $2', () => {
    const res = applyRule(
      'a1b2',
      r({ engine: 'regex', find: '(?<letter>[a-z])(\\d)', replace: '[$<letter>-$2]', flags: 'g' }),
    );
    assert.strictEqual(res.text, '[a-1][b-2]');
    assert.strictEqual(res.replacedCount, 2);
  });

  test('regex: 仅命名捕获时 $<n> 与 $1 指向同一捕获', () => {
    const res = applyRule('x=3', r({ engine: 'regex', find: 'x=(?<n>\\d)', replace: '$<n>=$1', flags: 'g' }));
    assert.strictEqual(res.text, '3=3');
    assert.strictEqual(res.replacedCount, 1);
  });

  test('template: supports escaped newline/tab/backslash', () => {
    const out = expandReplacementTemplate('line1\\n$1\\t\\\\', {
      match: 'x',
      groups: ['G1'],
      offset: 0,
      input: 'x',
    });
    assert.strictEqual(out, 'line1\nG1\t\\');
  });

  test('text: supports escaped newline in replacement', () => {
    const res = applyRule('a-b', r({ engine: 'text', find: '-', replace: '\\n' }));
    assert.strictEqual(res.text, 'a\nb');
    assert.strictEqual(res.replacedCount, 1);
  });
});

