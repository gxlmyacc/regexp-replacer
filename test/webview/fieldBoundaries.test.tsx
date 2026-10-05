import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { EditorView } from '@codemirror/view';
import { expect, test, vi } from 'vitest';
import { RuleExpressionField } from '../../webview/src/components/RuleExpressionField';
import { ReplacementTemplateField } from '../../webview/src/components/ReplacementTemplateField';
import { WildcardPatternField } from '../../webview/src/components/WildcardPatternField';
import { ListResultPanel } from '../../webview/src/components/ListResultPanel';
import { ReplaceResultBox } from '../../webview/src/components/ReplaceResultBox';
import { MatchDetailsPanel } from '../../webview/src/components/MatchDetailsPanel';
import { I18nProvider, useI18n } from '../../webview/src/i18n/I18nProvider';
import { copyTextToClipboard } from '../../webview/src/utils/clipboard';

function InvalidContext(): React.ReactElement { useI18n(); return <div />; }

test('表达式编辑器的三种引擎输入与通配符失焦', () => {
  const host = document.createElement('div'); document.body.appendChild(host); const change = vi.fn(); const after = vi.fn(); const blur = vi.fn();
  const flags: any = { flags: 'Flags', flagG: 'g', flagI: 'i', flagM: 'm', flagS: 's', flagU: 'u', flagY: 'y' };
  try {
    for (const engine of ['regex', 'text', 'wildcard'] as const) {
      act(() => { ReactDOM.render(<RuleExpressionField engine={engine} value="a" placeholder="Pattern" uiLanguage="en" flagLabels={flags} regexEnabledFlags={undefined} onToggleFlag={vi.fn()} onChange={change} onAfterChange={after} />, host); });
      if (engine === 'regex') act(() => { EditorView.findFromDOM(host.querySelector('.cm-editor')!)!.dispatch({ changes: { from: 0, to: 1, insert: 'b' } }); });
      else { const input = host.querySelector('textarea')!; act(() => { Simulate.change(input, { target: { value: 'b' } } as any); Simulate.input(input); }); }
      expect(change).toHaveBeenLastCalledWith('b');
    }
    act(() => { ReactDOM.render(<WildcardPatternField value={String.raw`\r\t\s+\S*\n?\*+\?*\q\\?`} onChange={change} onBlur={blur} />, host); });
    act(() => { Simulate.blur(host.querySelector('input')!); }); expect(blur).toHaveBeenCalled();
    act(() => { ReactDOM.render(<WildcardPatternField value="" onChange={change} />, host); }); expect(host.querySelector('.wildcard-pattern-field__placeholder')).not.toBeNull();
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); }
});

test('替换模板两位组号、字面量转义与空提示', () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  try {
    act(() => { ReactDOM.render(<ReplacementTemplateField value={String.raw`$12 $01 $99 $00 $100 \r\t\\\q $<> $<open $$ $&`} highlightEnabled maxCaptureGroupCount={12} onChange={vi.fn()} />, host); });
    expect(host.querySelector('.replacement-template-field__tok--replacement-index')?.textContent).toBe('$12'); expect(host.textContent).toContain('$99');
    act(() => { ReactDOM.render(<ReplacementTemplateField value="" highlightEnabled onChange={vi.fn()} />, host); }); expect(host.querySelector('.replacement-template-field__placeholder')?.textContent).toBe('');
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); }
});

test('列表键值容错与 Ctrl/Meta+A，替换结果空片段截断及缺失 Selection', () => {
  const host = document.createElement('div'); document.body.appendChild(host); const all = vi.fn();
  try {
    const matches: any = [{ matchText: 'A' }, { index: 1, matchText: 'B' }, { index: 2, startOffset: 2, matchText: 'C' }];
    act(() => { ReactDOM.render(<ListResultPanel matches={matches} maxItems={5} onCtrlA={all} />, host); }); expect(host.querySelectorAll('[role="listitem"]')).toHaveLength(3);
    for (const event of [{ key: 'x' }, { key: 'a' }, { key: 'a', ctrlKey: true }, { key: 'A', metaKey: true }]) act(() => { Simulate.keyDown(host.querySelector('[role="list"]')!, event); }); expect(all).toHaveBeenCalledTimes(2);
    act(() => { ReactDOM.render(<ReplaceResultBox parts={[{ text: '', replaced: false }, { text: 'ab', replaced: false }, { text: 'cd', replaced: true }]} fallbackText="" emptyText="Empty" replacedCount={1} maxChars={2} />, host); });
    expect(host.textContent).toContain('ab'); const selection = vi.spyOn(window, 'getSelection').mockReturnValue(null);
    act(() => { Simulate.keyDown(host.firstElementChild!, { key: 'a', ctrlKey: true }); }); selection.mockRestore();
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); }
});

test('详情中文错误和缺失引擎展示，i18n 使用边界与剪贴板失败', async () => {
  const host = document.createElement('div'); document.body.appendChild(host); localStorage.setItem('regexpReplacer.uiLanguage', 'zh-CN');
  try {
    act(() => { ReactDOM.render(<I18nProvider><MatchDetailsPanel engine={undefined} flagsDisplay="-" current={undefined} matchError="bad" /></I18nProvider>, host); }); expect(host.textContent).toContain('表达式校验失败');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {}); expect(() => act(() => { ReactDOM.render(<InvalidContext />, host); })).toThrow('useI18n'); errors.mockRestore();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); expect(await copyTextToClipboard('text')).toBe(false);
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); localStorage.clear(); }
});

