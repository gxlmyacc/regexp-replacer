import { describe, expect, test, vi } from 'vitest';
import {
  autoResizeTextarea,
  createRuleUid,
  hasAnyCapturingGroup,
  pickLocalizedString,
  sanitizeCommandsPayload,
  tokenizeRegexPattern,
} from '../../webview/src/utils';
import { mergeDevSeedDisplayFields } from '../../webview/src/utils/devSeedRelocale';

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

  test('pickLocalizedString：按语言取中英字典', () => {
    const o = { en: ' Hello ', 'zh-CN': '你好' };
    expect(pickLocalizedString(o, 'en')).toBe('Hello');
    expect(pickLocalizedString(o, 'zh-CN')).toBe('你好');
    expect(pickLocalizedString(' plain ', 'en')).toBe('plain');
  });

  test('sanitizeCommandsPayload：双语 title/description/规则 title 与 name 别名', () => {
    const raw = [
      {
        id: 'x1',
        title: { en: 'English title', 'zh-CN': '中文标题' },
        description: { en: 'En desc', 'zh-CN': '中文说明' },
        rules: [{ engine: 'regex', find: 'a', replace: 'b', name: { en: 'Rule EN', 'zh-CN': '规则中文' } }],
      },
    ];
    const en = sanitizeCommandsPayload(raw, { locale: 'en' });
    expect(en[0]?.title).toBe('English title');
    expect(en[0]?.description).toBe('En desc');
    expect((en[0]?.rules[0] as any).title).toBe('Rule EN');

    const zh = sanitizeCommandsPayload(raw, { locale: 'zh-CN' });
    expect(zh[0]?.title).toBe('中文标题');
    expect(zh[0]?.description).toBe('中文说明');
    expect((zh[0]?.rules[0] as any).title).toBe('规则中文');
  });

  test('mergeDevSeedDisplayFields：只更新 dev_sample_* 的展示字段且保留 find', () => {
    const current = [
      {
        id: 'dev_sample_01',
        title: 'Old title',
        description: 'Old desc',
        rules: [{ engine: 'regex' as const, find: 'USER', replace: 'X', flags: 'g', title: 'Old rule' }],
      },
      { id: 'other', title: 'Keep', rules: [{ engine: 'regex' as const, find: 'a', replace: 'b', flags: 'g' }] },
    ] as any;
    const seed = [
      {
        id: 'dev_sample_01',
        title: 'New title',
        description: 'New desc',
        rules: [{ engine: 'regex' as const, find: '\\d+', replace: '#$&', flags: 'g', title: 'New rule' }],
      },
    ] as any;
    const out = mergeDevSeedDisplayFields(current, seed);
    expect(out[0].title).toBe('New title');
    expect(out[0].description).toBe('New desc');
    expect(out[0].rules[0].find).toBe('USER');
    expect(out[0].rules[0].replace).toBe('X');
    expect((out[0].rules[0] as any).title).toBe('New rule');
    expect(out[1].title).toBe('Keep');
  });
});

