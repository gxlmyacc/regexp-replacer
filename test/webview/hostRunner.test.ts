import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as vscode from 'vscode';
import { applyCommandToText, HookLoopError, runReplaceInFile, runReplaceInSelection } from '../../src/replace/replaceRunner';
import { applyRule, applyMapFirstMatchToFragment, decodeEscapedReplacementTemplate, expandReplacementTemplate } from '../../src/replace/engines';
import { validateMapRuleOrThrow } from '../../src/replace/ruleValidation';
import { wildcardToRegexSource } from '../../src/replace/wildcard';
import type { ReplaceCommand, ReplaceRule } from '../../src/types';
const api = vscode as unknown as typeof import('./helpers/vscode');
const rule: ReplaceRule = { engine: 'text', find: 'a', replace: 'b' };
const command: ReplaceCommand = { id: 'main', title: 'Main', rules: [rule] };

/** 文档替身按照真实 edit 计划从末尾向前应用替换，保留多选区的偏移语义。 */
function makeEditor(initial = 'aa', ranges = [[0, 1], [1, 2], [0, 0]]) {
  let text = initial;
  const editor = {
    document: { getText: (range?: vscode.Range) => range ? text.slice(range.start.character, range.end.character) : text,
      positionAt: (offset: number) => new vscode.Position(0, offset) },
    selections: ranges.map(([start, end]) => ({ start: new vscode.Position(0, start), end: new vscode.Position(0, end), isEmpty: start === end })),
    edit: vi.fn(async (callback) => {
      const plans: Array<{ start: number; end: number; value: string }> = [];
      callback({ replace: (range: vscode.Range, value: string) => plans.push({ start: range.start.character, end: range.end.character, value }) });
      for (const plan of plans.sort((a, b) => b.start - a.start)) text = text.slice(0, plan.start) + plan.value + text.slice(plan.end);
      return true;
    }),
  };
  return editor as unknown as vscode.TextEditor;
}

beforeEach(() => { vi.clearAllMocks(); });
describe('file and selection execution', () => {
  test('pure command execution normalizes fields, flags and applies rules in order', () => {
    expect(applyCommandToText('Aa', { ...command, rules: [{ engine: 'regex', find: 'a', replace: 'b', flags: 'iigz' }, { ...rule, find: 'b', replace: 'c' }] })).toEqual({ text: 'cc', totalReplacedCount: 4, perRuleCounts: [2, 2] });
    expect(applyCommandToText('a', { ...command, rules: [{ engine: 'regex', find: 'a', replace: 'b', flags: 'z' }] }).text).toBe('b');
    expect(applyCommandToText('abc', { ...command, rules: [{ engine: 'text' } as ReplaceRule] }).text).toBe('abc');
  });
  test.each(['file', 'selection'])('%s respects disabled rules, chains hooks and executes external commands', async (scope) => {
    const editor = makeEditor();
    const chained = { ...command, id: 'chain', rules: [{ ...rule, enable: false }] };
    const main = { ...command, rules: [{ ...rule, find: 'b', replace: 'c', preCommands: ['chain', 'external'], postCommands: ['after'] }, { ...rule, enable: false }] };
    const run = scope === 'file' ? runReplaceInFile : runReplaceInSelection;
    const result = await run(editor, main, [main, chained]);
    expect(editor.document.getText()).toBe('cc');
    expect(result.perRuleCounts).toEqual([2, 0]);
    expect(api.commands.executeCommand.mock.calls).toEqual([['external'], ['after']]);
    await run(editor, { ...command, rules: [{ ...rule, find: 'z' }] });
    expect(editor.document.getText()).toBe('cc');
  });
  test.each(['file', 'selection'])('%s rejects cycles and unwinds the passed stack after exceptions', async (scope) => {
    const editor = makeEditor();
    const loop = { ...command, rules: [{ ...rule, preCommands: ['main'] }] };
    const run = scope === 'file' ? runReplaceInFile : runReplaceInSelection;
    await expect(run(editor, loop, [loop])).rejects.toBeInstanceOf(HookLoopError);
    const stack = ['main'];
    const invalid = { ...command, id: 'broken', rules: [{ ...rule, engine: 'regex' as const, find: '[' }] };
    const outer = { ...command, rules: [{ ...rule, preCommands: ['broken'] }] };
    await expect(run(editor, outer, [outer, invalid], stack)).rejects.toThrow();
    expect(stack).toEqual(['main']);
  });
});

describe('engine input boundaries', () => {
  test.each([{}, { cases: [] }, { cases: null }])('map rejects missing cases %j', (map) => {
    expect(() => validateMapRuleOrThrow({ ...rule, engine: 'regex', replaceMode: 'map', map: map as any })).toThrow('映射表不能为空');
  });
  test('map validation rejects other engines and malformed regex cases, but allows empty rows', () => {
    expect(() => validateMapRuleOrThrow({ ...rule, replaceMode: 'map' })).toThrow('仅支持 regex');
    expect(() => validateMapRuleOrThrow({ ...rule, engine: 'regex', replaceMode: 'map', map: { mode: 'regex', cases: [{ find: '[', replace: '' }] } })).toThrow();
    expect(() => validateMapRuleOrThrow({ ...rule, engine: 'regex', replaceMode: 'map', map: { mode: 'regex', cases: [null, { find: '', replace: '' }, { find: 'a', replace: '' }] as any } })).not.toThrow();
  });
  test('mapping skips invalid patterns and honors the first matching case', () => {
    expect(applyMapFirstMatchToFragment('aa', { mode: 'regex', cases: [{ find: '[', replace: '' }, { find: 'z', replace: '' }, { find: 'a', replace: 'b' }] })).toEqual({ text: 'bb', changed: true });
    expect(applyMapFirstMatchToFragment('aa', { mode: 'text', cases: [null, { find: '', replace: '' }, { find: 'z', replace: '' }, { find: 'a', replace: 'a' }] as any })).toEqual({ text: 'aa', changed: false });
    expect(applyMapFirstMatchToFragment('aa', {} as any)).toEqual({ text: 'aa', changed: false });
    expect(() => applyRule('a', { ...rule, engine: 'unknown' as any })).toThrow('不支持的替换引擎');
  });
  test.each(['n', 't', 's', 'S'])('wildcard escaped %s supports quantifiers and a following literal', (letter) => {
    for (const suffix of ['', '+', '*', '?', 'x']) {
      const pattern = `\\${letter}${suffix}`;
      expect(wildcardToRegexSource(pattern, false)).toBe(pattern);
    }
  });
  test('wildcard literal escapes and dotAll have correct matching semantics', () => {
    expect(new RegExp(wildcardToRegexSource(String.raw`a\*\?\z?*`, false)).test('a*?\\zx')).toBe(true);
    expect(new RegExp(wildcardToRegexSource('*', true)).test('\n')).toBe(true);
    expect(wildcardToRegexSource('\\', false)).toBe('\\\\');
  });
  test('template trailing escapes, unknown names and invalid indices remain safe', () => {
    expect(decodeEscapedReplacementTemplate('x\\r\\q\\')).toBe('x\r\\q\\');
    expect(expandReplacementTemplate('$<missing>|$<>|$<open|$0|$99|$', { match: 'a', groups: [], offset: 0, input: 'a' })).toBe('|$<>|$<open|$0|$99|$');
  });
});
