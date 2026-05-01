import { describe, expect, test, vi } from 'vitest';
import {
  autoResizeTextarea,
  buildRuleKey,
  getMatchIndexByOffset,
  isPristineUntitledDraft,
  isUntitledCommandTitle,
  normalizeCommandTitles,
} from '../../webview/src/utils';

describe('webview utils/index.ts', () => {
  test('buildRuleKey: uses cmdId + ruleUid', () => {
    expect(buildRuleKey('c1', 'u1')).toBe('c1::u1');
  });

  test('isUntitledCommandTitle: matches both languages', () => {
    expect(isUntitledCommandTitle('Untitled command')).toBe(true);
    expect(isUntitledCommandTitle('未命名命令')).toBe(true);
    expect(isUntitledCommandTitle('Hello')).toBe(false);
  });

  test('isPristineUntitledDraft: detects empty untitled draft', () => {
    expect(
      isPristineUntitledDraft({
        title: 'Untitled command',
        description: '',
        rules: [{ find: '', replace: '', preCommands: [], postCommands: [] }],
      } as any),
    ).toBe(true);
    expect(
      isPristineUntitledDraft({
        title: 'Untitled command',
        rules: [{ find: 'x', replace: '' }],
      } as any),
    ).toBe(false);
  });

  test('normalizeCommandTitles: normalizes untitled title to current language', () => {
    const out = normalizeCommandTitles([{ title: 'Untitled command' }, { title: 'X' }], '未命名命令');
    expect(out[0].title).toBe('未命名命令');
    expect(out[1].title).toBe('X');
  });

  test('getMatchIndexByOffset: finds index within ranges', () => {
    const items = [
      { startOffset: 0, endOffset: 2 },
      { startOffset: 3, endOffset: 5 },
    ];
    expect(getMatchIndexByOffset(items as any, 1)).toBe(0);
    expect(getMatchIndexByOffset(items as any, 4)).toBe(1);
    expect(getMatchIndexByOffset(items as any, 99)).toBeUndefined();
  });

  test('autoResizeTextarea: adjusts height with raf', () => {
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1 as any;
    });
    const el = document.createElement('textarea');
    Object.defineProperty(el, 'scrollHeight', { value: 123, configurable: true });
    autoResizeTextarea(el);
    expect(el.style.height).toBe('123px');
    raf.mockRestore();
  });
});

