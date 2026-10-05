import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { expect, test, vi } from 'vitest';
import { RuleTitleEditor } from '../../webview/src/components/RuleTitleEditor';
import { ReplacementTemplateField } from '../../webview/src/components/ReplacementTemplateField';
import { WildcardPatternField } from '../../webview/src/components/WildcardPatternField';
import { ExplainTabContent } from '../../webview/src/components/ExplainTabContent';
import { ListResultPanel } from '../../webview/src/components/ListResultPanel';
import { ReplaceResultBox } from '../../webview/src/components/ReplaceResultBox';
import { I18nProvider } from '../../webview/src/i18n/I18nProvider';
import { Popover, Toast } from '../../webview/src/components/base';

test('标题 Enter 提交、空标题 Escape 取消，替换组号色阶缺省和自定义映射', () => {
  const host = document.createElement('div'); document.body.appendChild(host); const commit = vi.fn();
  const render = (el: React.ReactElement) => act(() => { ReactDOM.render(el, host); });
  try {
    render(<RuleTitleEditor fallbackLabel="Rule" placeholder="Name" onCommit={commit} />);
    act(() => { host.querySelector('button')!.click(); });
    act(() => { Simulate.change(host.querySelector('input')!, { target: { value: 'New' } } as any); });
    act(() => { Simulate.keyDown(host.querySelector('input')!, { key: 'Enter' }); }); expect(commit).toHaveBeenCalledWith('New');
    act(() => { host.querySelector('button')!.click(); }); act(() => { Simulate.keyDown(host.querySelector('input')!, { key: 'Escape' }); }); expect(host.querySelector('input')).toBeNull();
    render(<ReplacementTemplateField value="$1$2" highlightEnabled captureGroupLevels={[4]} onChange={vi.fn()} />);
    expect(host.querySelector('.replacement-template-field__tok--replacement-index-l4')?.textContent).toBe('$1');
    expect(host.querySelector('.replacement-template-field__tok--replacement-index-l2')?.textContent).toBe('$2');
    render(<WildcardPatternField value={String.raw`\n*\t?\r+*?`} onChange={vi.fn()} />); expect(host.textContent).toContain(String.raw`\n*`);
    expect(host.querySelector('.wildcard-pattern-field__tok--wildcard-quant-star')?.textContent).toBe('*');
    expect(host.querySelector('.wildcard-pattern-field__tok--wildcard-quant-qmark')?.textContent).toBe('?');
    render(<I18nProvider><ExplainTabContent regexPattern="(a)" /></I18nProvider>); expect(host.querySelectorAll('li').length).toBeGreaterThan(0);
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); }
});

test('结果完整偏移键值、普通按键和 Meta 全选', () => {
  const host = document.createElement('div'); document.body.appendChild(host);
  try {
    act(() => { ReactDOM.render(<ListResultPanel matches={[{ index: 0, startOffset: 0, endOffset: 1, matchText: 'a', groups: [] }]} maxItems={2} />, host); }); expect(host.textContent).toContain('a');
    act(() => { ReactDOM.render(<ReplaceResultBox parts={[{ text: 'abc', replaced: false }]} fallbackText="abc" emptyText="Empty" replacedCount={0} maxChars={100} />, host); });
    const el = host.firstElementChild!;
    for (const event of [{ key: 'x' }, { key: 'a' }, { key: 'A', metaKey: true }]) act(() => { Simulate.keyDown(el, event); });
    expect(window.getSelection()?.toString()).toBe('1abc');
  } finally { act(() => { ReactDOM.unmountComponentAtNode(host); }); host.remove(); }
});

test('Popover 缺失锚点及自定义箭头；Toast 重复暂停恢复幂等且到期关闭', () => {
  const host = document.createElement('div'); document.body.appendChild(host); vi.useFakeTimers();
  try {
    act(() => { ReactDOM.render(<Popover open referenceEl={null} arrow arrowClassName="custom-arrow">Content</Popover>, host); }); expect(document.querySelector('.custom-arrow')).not.toBeNull();
    act(() => { ReactDOM.render(<Popover open referenceEl={host} arrow>Default arrow</Popover>, host); }); expect(document.querySelector('.rrPopoverArrow')).not.toBeNull();
    act(() => { Toast.dismiss(); Toast.pause(); Toast.resume(); Toast.show('Timer', 'info', 1000); Toast.resume(); Toast.pause(); Toast.pause(); });
    act(() => { vi.advanceTimersByTime(2000); }); expect(document.querySelector('[role="status"]')).not.toBeNull();
    act(() => { Toast.resume(); Toast.resume(); vi.advanceTimersByTime(1001); }); expect(document.querySelector('[role="status"]')).toBeNull();
    act(() => { Toast.show(undefined as any); }); expect(document.querySelector('[role="status"]')).not.toBeNull();
  } finally { act(() => { Toast.dismiss(); ReactDOM.unmountComponentAtNode(host); }); host.remove(); vi.useRealTimers(); }
});
