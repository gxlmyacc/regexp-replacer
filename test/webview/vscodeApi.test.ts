import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createVscodeApi } from '../../webview/src/bridge/vscodeApi';

const commands = [{ id: 'saved', title: 'Saved', rules: [{ engine: 'text', find: 'a', replace: 'b' }] }];

describe('browser bridge', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/regexp-replacer/');
  });

  afterEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('loads seed commands from the website subdirectory', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => commands });
    vi.stubGlobal('fetch', fetchMock);
    const messages = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
    createVscodeApi().postMessage({ type: 'getConfig' });
    await vi.waitFor(() => expect(messages).toHaveBeenCalledWith({ type: 'config', payload: commands }, '*'));
    const requestedUrl = new URL(fetchMock.mock.calls[0][0], document.baseURI);
    expect(requestedUrl.pathname).toBe('/regexp-replacer/regexpReplacer.dev.commands.json');
  });

  test('saved commands and UI state survive a new bridge instance', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const messages = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
    const api = createVscodeApi();
    api.postMessage({ type: 'setConfig', payload: commands });
    api.setState({ selectedCommandId: 'saved' });
    const reopened = createVscodeApi();
    reopened.postMessage({ type: 'getConfig' });
    expect(messages).toHaveBeenLastCalledWith({ type: 'config', payload: commands }, '*');
    expect(reopened.getState()).toEqual({ selectedCommandId: 'saved' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('an intentionally empty saved list does not reload demo commands', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const messages = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
    const api = createVscodeApi();
    api.postMessage({ type: 'setConfig', payload: [] });
    api.postMessage({ type: 'getConfig' });
    expect(messages).toHaveBeenLastCalledWith({ type: 'config', payload: [] }, '*');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('a failed seed fetch can be retried', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, json: async () => commands });
    vi.stubGlobal('fetch', fetchMock);
    const messages = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
    const api = createVscodeApi();
    api.postMessage({ type: 'getConfig' });
    await vi.waitFor(() => expect(messages).toHaveBeenCalledWith({ type: 'config', payload: [] }, '*'));
    expect(localStorage.getItem('regexpReplacer.__mockSeeded__')).toBeNull();
    api.postMessage({ type: 'getConfig' });
    await vi.waitFor(() => expect(messages).toHaveBeenLastCalledWith({ type: 'config', payload: commands }, '*'));
  });

  test('exports commands as a downloadable JSON blob', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:commands');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.download).toBe('regexp-replacer.commands.json');
      expect(this.href).toBe('blob:commands');
    });
    vi.spyOn(window, 'postMessage').mockImplementation(() => {});
    createVscodeApi().postMessage({ type: 'exportCommands', payload: commands });
    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(createObjectURL.mock.calls[0][0].type).toBe('application/json;charset=utf-8');
    await vi.waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:commands'));
  });

  test('imports JSON through the browser file picker and persists it', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function () {
      Object.defineProperty(this, 'files', { value: [new File([JSON.stringify(commands)], 'commands.json')] });
      this.dispatchEvent(new Event('change'));
    });
    const messages = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
    createVscodeApi().postMessage({ type: 'importCommands' });
    await vi.waitFor(() => expect(messages).toHaveBeenCalledWith({ type: 'config', payload: commands }, '*'));
    expect(JSON.parse(localStorage.getItem('regexpReplacer.commands')!)).toEqual(commands);
  });
});
