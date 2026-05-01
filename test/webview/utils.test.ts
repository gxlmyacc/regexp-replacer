import { describe, expect, test } from 'vitest';
import { tokenizeRegexPattern } from '../../webview/src/utils';

describe('webview utils', () => {
  test('tokenizeRegexPattern: highlights meta tokens', () => {
    const tokens = tokenizeRegexPattern('(ab)+\\d{2,3}');
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.some((t) => t.type === 'group')).toBe(true);
    expect(tokens.some((t) => t.type === 'quant')).toBe(true);
    expect(tokens.some((t) => t.type === 'escape')).toBe(true);
  });
});

