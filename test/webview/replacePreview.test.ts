import { describe, expect, test } from 'vitest';
import { computeReplacePreview } from '../../webview/src/features/tools/replacePreview';

describe('webview replacePreview', () => {
  test('empty find: no replace, returns input as fullText', () => {
    const res = computeReplacePreview(
      { engine: 'regex', find: '', replace: 'x', flags: 'g' },
      'abc',
      'x',
      { maxPreviewChars: 1000 },
    );
    expect(res.replacedCount).toBe(0);
    expect(res.fullText).toBe('abc');
    expect(res.previewText).toBe('abc');
    expect(res.previewParts.length).toBe(1);
  });

  test('regex replace: previewParts mark replaced segments', () => {
    const res = computeReplacePreview(
      { engine: 'regex', find: '(\\d+)', replace: '', flags: 'g' },
      'a1 b22',
      'N($1)',
      { maxPreviewChars: 1000 },
    );
    expect(res.replacedCount).toBe(2);
    expect(res.fullText).toBe('aN(1) bN(22)');
    expect(res.previewParts.some((p) => p.replaced)).toBe(true);
  });

  test('regex replace: supports escaped newline in template', () => {
    const res = computeReplacePreview(
      { engine: 'regex', find: '(\\d+)', replace: '', flags: 'g' },
      'a1b2',
      'L$1\\n',
      { maxPreviewChars: 1000 },
    );
    expect(res.replacedCount).toBe(2);
    expect(res.fullText).toBe('aL1\nbL2\n');
  });

  test('maxPreviewChars: truncates preview but keeps fullText', () => {
    const res = computeReplacePreview(
      { engine: 'text', find: 'a', replace: '', flags: 'g' } as any,
      'aaaaaa',
      'b',
      { maxPreviewChars: 3 },
    );
    expect(res.fullText).toBe('bbbbbb');
    // 达到上限后会停止写入 preview；在“刚好到达上限”的情况下不会追加省略号
    expect(res.previewText).toBe('bbb');
  });

  test('text replace: supports escaped newline in template', () => {
    const res = computeReplacePreview(
      { engine: 'text', find: '-', replace: '', flags: 'g' } as any,
      'x-y-z',
      '\\n',
      { maxPreviewChars: 1000 },
    );
    expect(res.replacedCount).toBe(2);
    expect(res.fullText).toBe('x\ny\nz');
  });

  test('regex map: first row wins per fragment; chained rows are skipped', () => {
    const res = computeReplacePreview(
      {
        engine: 'regex',
        find: '(AB)',
        replace: '',
        flags: 'g',
        replaceMode: 'map',
        map: {
          mode: 'text',
          cases: [
            { find: 'A', replace: 'X' },
            { find: 'B', replace: 'Y' },
          ],
        },
      } as any,
      'AB',
      'unused',
      { maxPreviewChars: 1000 },
    );
    expect(res.fullText).toBe('XB');
    expect(res.replacedCount).toBe(1);
  });

  test('regex map: applies cases replacements within main match fragments (counts only when changed)', () => {
    const res = computeReplacePreview(
      {
        engine: 'regex',
        find: 'x=([A-Z])',
        replace: '',
        flags: 'g',
        replaceMode: 'map',
        map: { mode: 'text', cases: [{ find: 'A', replace: 'AA' }, { find: 'C', replace: 'CC' }] },
      } as any,
      'x=A; x=B; x=C;',
      'unused',
      { maxPreviewChars: 1000 },
    );
    expect(res.fullText).toBe('x=AA; x=B; x=CC;');
    expect(res.replacedCount).toBe(2);
  });

  test('regex map: regex mode supports replacement template escapes', () => {
    const res = computeReplacePreview(
      {
        engine: 'regex',
        find: 'x=(\\d+)',
        replace: '',
        flags: 'g',
        replaceMode: 'map',
        map: { mode: 'regex', cases: [{ find: '(\\d+)', replace: 'N($1)\\n' }] },
      } as any,
      'x=12;',
      'unused',
      { maxPreviewChars: 1000 },
    );
    expect(res.fullText).toBe('x=N(12)\n;');
    expect(res.replacedCount).toBe(1);
  });
});

