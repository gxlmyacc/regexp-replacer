import { afterEach, expect, test, vi } from 'vitest';
import { createVscodeApi } from '../../webview/src/bridge/vscodeApi';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

test('VS Code 宿主消息与状态透传', () => {
  const native = { postMessage: vi.fn(), getState: vi.fn().mockReturnValue({ selected: 'a' }), setState: vi.fn() };
  vi.stubGlobal('acquireVsCodeApi', () => native); const api = createVscodeApi(); api.postMessage({ type: 'getConfig' }); expect(native.postMessage).toHaveBeenCalledWith({ type: 'getConfig' }); expect(api.getState()).toEqual({ selected: 'a' }); api.setState({ x: 1 }); expect(native.setState).toHaveBeenCalledWith({ x: 1 });
});

test('浏览器消息语言和缺省提示，损坏与禁止写入的存储', () => {
  const messages = vi.spyOn(window, 'postMessage').mockImplementation(() => {}); const api = createVscodeApi();
  localStorage.setItem('regexpReplacer.__mockState__', '{bad'); expect(api.getState()).toBeUndefined();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); }); expect(() => api.setState({ x: 1 })).not.toThrow();
  for (const type of ['showInfo', 'showError']) { api.postMessage({ type, payload: { message: 'Message' } } as any); expect(messages.mock.lastCall?.[0].payload.message).toBe('Message'); api.postMessage({ type } as any); expect(messages.mock.lastCall?.[0].payload.message).toBeTruthy(); }
  const lang = vi.spyOn(navigator, 'language', 'get').mockReturnValue(''); api.postMessage({ type: 'getLanguage' }); expect(messages).toHaveBeenLastCalledWith({ type: 'language', payload: { language: 'en' } }, '*'); lang.mockRestore();
  api.postMessage({ type: 'exportCommands', payload: [] }); expect(messages.mock.lastCall?.[0].type).toBe('info');
});

test('种子返回非数组或 HTTP 失败时保持空配置', async () => {
  const messages = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
  for (const response of [{ ok: false }, { ok: true, json: async () => ({ wrong: true }) }]) {
    localStorage.clear(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response)); createVscodeApi().postMessage({ type: 'getConfig' });
    await vi.waitFor(() => expect(localStorage.getItem('regexpReplacer.commands')).toBe('[]')); expect(messages.mock.lastCall?.[0].payload).toEqual([]);
  }
});

test('取消导入、损坏 JSON 与读取错误返回失败消息', async () => {
  const messages = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
  for (const content of [null, '{broken', '{}']) {
    messages.mockClear(); const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function () { Object.defineProperty(this, 'files', { value: content === null ? [] : [new File([content], 'data.json')] }); this.dispatchEvent(new Event('change')); });
    createVscodeApi().postMessage({ type: 'importCommands' }); await vi.waitFor(() => expect(messages).toHaveBeenCalledWith({ type: 'error', payload: { message: 'Invalid JSON.' } }, '*')); click.mockRestore();
  }
  vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function () { Object.defineProperty(this, 'files', { value: [new File(['[]'], 'data.json')] }); this.dispatchEvent(new Event('change')); });
  vi.stubGlobal('FileReader', class { onerror?: () => void; readAsText() { this.onerror?.(); } }); messages.mockClear(); createVscodeApi().postMessage({ type: 'importCommands' }); await vi.waitFor(() => expect(messages.mock.lastCall?.[0].type).toBe('error'));
});
