import { describe, expect, test, vi } from 'vitest';
import {
  persistLeftPanelCollapsed,
  persistSplitterToggleArrowVisible,
  readStoredLeftPanelCollapsed,
  readStoredSplitterToggleArrowVisible,
} from '../../webview/src/utils/storage';

describe('utils/storage', () => {
  test('leftPanelCollapsed：默认 false；可读写；异常时兜底', () => {
    localStorage.clear();
    expect(readStoredLeftPanelCollapsed()).toBe(false);

    persistLeftPanelCollapsed(true);
    expect(readStoredLeftPanelCollapsed()).toBe(true);

    persistLeftPanelCollapsed(false);
    expect(readStoredLeftPanelCollapsed()).toBe(false);

    const getSpy = vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(readStoredLeftPanelCollapsed()).toBe(false);
    getSpy.mockRestore();

    const setSpy = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => persistLeftPanelCollapsed(true)).not.toThrow();
    setSpy.mockRestore();
  });

  test('splitterToggleArrowVisible：默认 true；可读写；异常时兜底', () => {
    localStorage.clear();
    expect(readStoredSplitterToggleArrowVisible()).toBe(true);

    persistSplitterToggleArrowVisible(false);
    expect(readStoredSplitterToggleArrowVisible()).toBe(false);

    persistSplitterToggleArrowVisible(true);
    expect(readStoredSplitterToggleArrowVisible()).toBe(true);

    const getSpy = vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(readStoredSplitterToggleArrowVisible()).toBe(true);
    getSpy.mockRestore();

    const setSpy = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => persistSplitterToggleArrowVisible(true)).not.toThrow();
    setSpy.mockRestore();
  });
});

