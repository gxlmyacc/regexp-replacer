import { describe, expect, test, vi } from 'vitest';
import { Toast } from '../../webview/src/components/base/Toast';

describe('Toast (extra)', () => {
  test('show：未传 durationMs 时按 message 字数自动计算（1600–5000ms）', () => {
    Toast.dismiss();
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    try {
      Toast.show('短消息');
      const args1 = setTimeoutSpy.mock.calls.at(-1) ?? [];
      const ms1 = Number(args1[1]);
      expect(ms1).toBeGreaterThanOrEqual(1600);
      expect(ms1).toBeLessThanOrEqual(5000);

      // 超长文案应触发上限裁剪
      Toast.show('a'.repeat(10_000));
      const args2 = setTimeoutSpy.mock.calls.at(-1) ?? [];
      const ms2 = Number(args2[1]);
      expect(ms2).toBe(5000);
    } finally {
      setTimeoutSpy.mockRestore();
      Toast.dismiss();
    }
  });

  test('show：显式传入 durationMs 时仍使用传入值（并做 >=0 保护）', () => {
    Toast.dismiss();
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    try {
      Toast.show('m', 'info', 1234);
      const args1 = setTimeoutSpy.mock.calls.at(-1) ?? [];
      const ms1 = Number(args1[1]);
      expect(ms1).toBe(1234);

      Toast.show('m', 'info', -10);
      const args2 = setTimeoutSpy.mock.calls.at(-1) ?? [];
      const ms2 = Number(args2[1]);
      expect(ms2).toBe(0);
    } finally {
      setTimeoutSpy.mockRestore();
      Toast.dismiss();
    }
  });

  test('pause/resume：无 toast 时安全；有 toast 时可暂停并恢复', () => {
    Toast.dismiss();
    expect(() => Toast.pause()).not.toThrow();
    expect(() => Toast.resume()).not.toThrow();

    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    Toast.show('m', 'info', 50);
    Toast.pause();
    Toast.resume();

    expect(setTimeoutSpy).toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
    Toast.dismiss();
  });
});

