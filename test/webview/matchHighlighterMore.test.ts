import { describe, expect, test } from 'vitest';
import { buildSearchRegex, computeMatches, escapeRegexLiteral, normalizeFlags, wildcardToRegexSource } from '../../webview/src/features/tester/matchHighlighter';

describe('matchHighlighter (extra)', () => {
  test('normalizeFlags：去重/过滤并强制包含 g', () => {
    expect(normalizeFlags('iiimx', { forceGlobal: true })).toBe('gim');
    expect(normalizeFlags('g', { forceGlobal: true })).toBe('g');
    expect(normalizeFlags('', { forceGlobal: true })).toBe('g');
  });

  test('escapeRegexLiteral：转义元字符', () => {
    expect(escapeRegexLiteral('a+b?')).toBe('a\\+b\\?');
    expect(escapeRegexLiteral('[a]')).toBe('\\[a\\]');
  });

  test('wildcardToRegexSource：支持 * ? 以及转义与 dotAll', () => {
    expect(wildcardToRegexSource('a*?\\n\\*\\?', false)).toContain('[^\\n]');
    expect(wildcardToRegexSource('a*?\\n', true)).toContain('[\\s\\S]');
    expect(wildcardToRegexSource('\\', false)).toContain('\\\\');
  });

  test('buildSearchRegex：text 引擎为字面量全局；wildcard 引擎可选 dotAll', () => {
    const reText = buildSearchRegex({ engine: 'text', find: 'a+b', replace: '' });
    expect(reText.flags).toContain('g');
    expect(reText.source).toContain('a\\+b');

    const reWild = buildSearchRegex({ engine: 'wildcard', find: 'a*', replace: '', wildcardOptions: { dotAll: true } });
    expect(reWild.flags).toContain('g');
    expect(reWild.flags).toContain('s');
  });

  test('computeMatches：空匹配会推进 lastIndex 避免死循环', () => {
    const items = computeMatches({ engine: 'regex', find: '.*?', replace: '', flags: 'g' }, 'ab', { maxMatches: 5 });
    // 0 长度匹配也会被推进，至少能拿到多条
    expect(items.length).toBeGreaterThan(1);
  });
});

