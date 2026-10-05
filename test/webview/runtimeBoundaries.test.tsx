import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { attachHorizontalSplitDrag, attachVerticalSplitDrag } from '../../webview/src/hooks/paneSplitDrag';
import { getDict, getInitialUiLanguage, normalizeLanguage, persistUiLanguage, readStoredUiLanguage } from '../../webview/src/i18n';
import { I18nProvider, useI18n } from '../../webview/src/i18n/I18nProvider';
import { buildRegexExplainOutline } from '../../webview/src/utils/regexHighlight/explainOutline';
import { buildRegexHighlightModel } from '../../webview/src/utils/regexHighlight/buildRegexHighlightModel';
import { truncatePatternSnippet } from '../../webview/src/utils/regexHighlight/astCommon';
import { scanRegexCaptureDecorHints } from '../../webview/src/utils/regexLint/internal/scanRegexCaptureDecorHints';

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('split drag bounds and cleanup', () => {
  test.each(['vertical', 'horizontal'])('%s drag clamps both ends and unregisters on mouseup', (direction) => {
    const resize = vi.fn();
    const preventDefault = vi.fn();
    const event = { clientX: 100, clientY: 100, preventDefault } as unknown as React.MouseEvent;
    if (direction === 'vertical') attachVerticalSplitDrag(event, { startWidth: 150, min: 100, max: 200, onResize: resize });
    else attachHorizontalSplitDrag(event, { startHeight: 150, min: 100, max: 200, onResize: resize });
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 110, clientY: 90 }));
    expect(resize).toHaveBeenLastCalledWith(160);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: -500 }));
    expect(resize).toHaveBeenLastCalledWith(200);
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: -500, clientY: 500 }));
    expect(resize).toHaveBeenLastCalledWith(100);
    window.dispatchEvent(new MouseEvent('mouseup'));
    window.dispatchEvent(new MouseEvent('mousemove'));
    expect(resize).toHaveBeenCalledTimes(3);
    expect(preventDefault).toHaveBeenCalledOnce();
  });
});

describe('language persistence', () => {
  test('missing and invalid preferences fall back to English; both dictionaries have identical keys', () => {
    expect(readStoredUiLanguage()).toBeUndefined();
    expect(getInitialUiLanguage()).toBe('en');
    localStorage.setItem('regexpReplacer.uiLanguage', 'invalid');
    expect(getInitialUiLanguage()).toBe('en');
    for (const lang of ['en', 'zh-CN'] as const) {
      persistUiLanguage(lang);
      expect(getInitialUiLanguage()).toBe(lang);
    }
    expect(Object.keys(getDict('en')).sort()).toEqual(Object.keys(getDict('zh-CN')).sort());
    expect(normalizeLanguage('ZH-HANS')).toBe('zh-CN');
    expect(normalizeLanguage('fr')).toBe('en');
    expect(normalizeLanguage(undefined as unknown as string)).toBe('en');
  });
  test('storage failures do not prevent initialization', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getInitialUiLanguage()).toBe('en');
    expect(() => persistUiLanguage('zh-CN')).not.toThrow();
  });
  test('provider switches the dictionary and saves the selected language', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    function LanguageSwitch() {
      const { lang, setLang } = useI18n();
      return <button onClick={() => setLang('zh-CN')}>{lang}</button>;
    }
    try {
      act(() => { ReactDOM.render(<I18nProvider><LanguageSwitch /></I18nProvider>, host); });
      act(() => { host.querySelector('button')!.click(); });
      expect(host.textContent).toBe('zh-CN');
      expect(readStoredUiLanguage()).toBe('zh-CN');
    } finally { ReactDOM.unmountComponentAtNode(host); host.remove(); }
  });
});

describe('AST explanations and capture syntax', () => {
  test('AST patches cover assertions, sets, classes, quantifiers and both backreference forms', () => {
    const source = String.raw`^(?<name>[ab]+)(?:\d).\1\k<name>$`;
    const model = buildRegexHighlightModel(source, 'u');
    expect(model.meta).toEqual({ parseOk: true, usedAstEnhancement: true });
    for (const kind of ['anchor', 'class', 'quant', 'escape', 'dot']) {
      expect(model.semanticSpans.some((span) => span.kind === kind)).toBe(true);
    }
    const outline = buildRegexExplainOutline(source, 'u', getDict('en'));
    expect(outline.parseOk).toBe(true);
    expect(outline.segments.some(({ text }) => text.includes('(?<name>'))).toBe(true);
    expect(outline.segments.some(({ text }) => text.includes('(?:'))).toBe(true);
    expect(truncatePatternSnippet('abcdef', 1, 6, 3)).toBe('bcd…');
    expect(truncatePatternSnippet('abc', 0, 2, 3)).toBe('ab');
  });
  test.each([String.raw`\d[a]+(?:b)|^.$(`, '[' + 'x'.repeat(35), '(?=', '(?:', 'a{2,4}('])('invalid pattern %s gets a localized fallback', (pattern) => {
    const result = buildRegexExplainOutline(pattern, '', getDict('zh-CN'));
    expect(result.parseOk).toBe(false);
    expect(result.parseErrorDetail).toBeTruthy();
    expect(result.segments.length).toBeGreaterThan(1);
  });
  test('empty and absent input yields an empty explanation and no semantic spans', () => {
    const source = undefined as unknown as string;
    expect(buildRegexExplainOutline(source, source, getDict('en')).segments).toEqual([{ text: getDict('en').explainRegexEmptyPattern }]);
    expect(buildRegexHighlightModel(source, source).semanticSpans).toEqual([]);
  });
  test.each([
    [String.raw`(?# escaped \) and (ignored))(a)`, 1],
    ['(?#unfinished(a)', 0],
    [String.raw`(?<na\>me>a)(b)`, 2],
    ['(?<unfinished', 1],
    ["(?'name'a)(b)", 2],
    ["(?'unfinished", 1],
    ['(?x:a)(b)', 2],
    ['[^](a)](b)', 1],
  ])('capture scanner handles incomplete/extended syntax %s', (pattern, count) => {
    expect(scanRegexCaptureDecorHints(pattern).capturingOpens).toHaveLength(count);
  });
});
