import { describe, expect, test, vi } from 'vitest';
import { copyTextToClipboard } from '../../webview/src/utils/clipboard';

describe('webview clipboard', () => {
  test('uses Clipboard API when available', async () => {
    const writeText = vi.fn(async () => undefined);
    // @ts-expect-error: mock clipboard
    navigator.clipboard = { writeText };
    const ok = await copyTextToClipboard('abc');
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('abc');
  });

  test('falls back to textarea when Clipboard API throws', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('nope');
    });
    // @ts-expect-error: mock clipboard
    navigator.clipboard = { writeText };

    // jsdom 默认不实现 execCommand，这里手动挂载一个可监控的 mock
    const execMock = vi.fn(() => true);
    (document as any).execCommand = execMock;
    const ok = await copyTextToClipboard('abc');
    expect(ok).toBe(true);
    expect(execMock).toHaveBeenCalledWith('copy');
  });
});

