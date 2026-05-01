import { describe, expect, test } from 'vitest';
import { buildSearchRegex, computeMatches, normalizeFlags } from '../../webview/src/features/tester/matchHighlighter';

describe('webview matchHighlighter', () => {
  test('normalizeFlags: dedupe, filter invalid, force g', () => {
    expect(normalizeFlags('iigZ', { forceGlobal: true })).toBe('ig');
    expect(normalizeFlags('', { forceGlobal: true })).toBe('g');
  });

  test('buildSearchRegex: text engine uses escaped literal', () => {
    const re = buildSearchRegex({ engine: 'text', find: 'a.b', replace: '' });
    expect(re.source).toBe('a\\.b');
    expect(re.flags.includes('g')).toBe(true);
  });

  test('computeMatches: avoids infinite loop on empty match', () => {
    const items = computeMatches({ engine: 'regex', find: '.*?', replace: '', flags: 'g' }, 'ab', { maxMatches: 5 });
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(5);
  });
});

