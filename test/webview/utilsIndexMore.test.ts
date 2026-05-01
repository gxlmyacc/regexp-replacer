import { describe, expect, test, vi } from 'vitest';
import { autoResizeTextarea, createRuleUid, hasAnyCapturingGroup, tokenizeRegexPattern } from '../../webview/src/utils';

describe('utils/index (extra)', () => {
  test('createRuleUid：包含前缀且可重复调用', () => {
    const a = createRuleUid();
    const b = createRuleUid();
    expect(a).toMatch(/^rule_/);
    expect(b).toMatch(/^rule_/);
    expect(a).not.toBe(b);
  });

  test('autoResizeTextarea：会用 rAF 更新 height', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1 as any;
    });
    const cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const el = document.createElement('textarea');
    Object.defineProperty(el, 'scrollHeight', { value: 123, configurable: true });
    autoResizeTextarea(el);
    expect(el.style.height).toBe('123px');
    // 再调用一次会 cancel 上一次 id
    autoResizeTextarea(el);
    expect(cafSpy).toHaveBeenCalled();
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  test('tokenizeRegexPattern：覆盖 escape/class/group/quant/alt/anchor/dot/text', () => {
    const tokens = tokenizeRegexPattern(String.raw`\.\[a\] ( ) { } * + ? | ^ $ . [a\]b] x`);
    const types = new Set(tokens.map((t) => t.type));
    expect(types.has('escape')).toBe(true);
    expect(types.has('class')).toBe(true);
    expect(types.has('group')).toBe(true);
    expect(types.has('quant')).toBe(true);
    expect(types.has('alt')).toBe(true);
    expect(types.has('anchor')).toBe(true);
    expect(types.has('dot')).toBe(true);
    expect(types.has('text')).toBe(true);
  });

  test('hasAnyCapturingGroup：识别捕获组并忽略字符类内括号', () => {
    expect(hasAnyCapturingGroup('(a)(?:b)')).toBe(true);
    expect(hasAnyCapturingGroup('(?:a)(?=b)')).toBe(false);
    expect(hasAnyCapturingGroup('[()]()')).toBe(true);
    expect(hasAnyCapturingGroup('[()]')).toBe(false);
  });
});

