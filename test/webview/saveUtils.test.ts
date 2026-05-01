import { describe, expect, test } from 'vitest';
import { buildPayloadFromList, findFirstUntitledCommand, isSavableRule, validateCommandName } from '../../webview/src/features/commands/saveUtils';

describe('webview saveUtils', () => {
  test('isSavableRule: find non-empty => savable', () => {
    expect(isSavableRule({ find: 'abc' })).toBe(true);
    expect(isSavableRule({ find: '  abc  ' })).toBe(true);
  });

  test('isSavableRule: empty find but has hooks => savable (orchestration rule)', () => {
    expect(isSavableRule({ find: '', preCommands: ['x'] })).toBe(true);
    expect(isSavableRule({ find: '   ', postCommands: ['y'] })).toBe(true);
    expect(isSavableRule({ find: '', preCommands: [], postCommands: ['y'] })).toBe(true);
  });

  test('isSavableRule: empty find and no hooks => not savable', () => {
    expect(isSavableRule({ find: '' })).toBe(false);
    expect(isSavableRule({ find: '   ', preCommands: [], postCommands: [] })).toBe(false);
  });

  test('buildPayloadFromList: keeps orchestration rules and filters empty-only rules', () => {
    const list = [
      {
        id: 'a',
        title: 'A',
        rules: [
          { find: '', preCommands: ['b'], postCommands: [] }, // orchestration
          { find: 'x', preCommands: [], postCommands: [] }, // normal
          { find: '   ', preCommands: [], postCommands: [] }, // empty
        ],
      },
      {
        id: 'draft',
        title: 'Untitled command',
        rules: [{ find: '' }],
      },
    ];

    const payload = buildPayloadFromList(list, (c) => c.id === 'draft');
    expect(payload.map((c) => c.id)).toEqual(['a']);
    expect(payload[0].rules.length).toBe(2);
    expect(payload[0].rules[0].preCommands).toEqual(['b']);
    expect(payload[0].rules[1].find).toBe('x');
  });

  test('findFirstUntitledCommand: finds untitled but skips pristine draft when provided', () => {
    const list = [
      { id: 'd', title: 'Untitled command', rules: [{ find: '' }] },
      { id: 'u', title: 'Untitled command', rules: [{ find: 'x' }] },
      { id: 'n', title: 'Named', rules: [{ find: 'x' }] },
    ];
    const found = findFirstUntitledCommand(list, (c) => c.id === 'd');
    expect(found?.id).toBe('u');
  });

  test('validateCommandName: required and duplicate', () => {
    const all = [
      { id: 'a', title: 'Hello' },
      { id: 'b', title: 'World' },
    ];
    expect(
      validateCommandName(all, '   ', 'x', { nameRequired: 'REQ', nameDuplicate: 'DUP', nameReservedChars: 'RES' }),
    ).toBe('REQ');
    expect(
      validateCommandName(all, 'hello', 'x', { nameRequired: 'REQ', nameDuplicate: 'DUP', nameReservedChars: 'RES' }),
    ).toBe('DUP');
    expect(
      validateCommandName(all, 'hello', 'a', { nameRequired: 'REQ', nameDuplicate: 'DUP', nameReservedChars: 'RES' }),
    ).toBeUndefined();
  });

  test('validateCommandName: forbids reserved chars <>[]', () => {
    const all = [
      { id: 'a', title: 'Cmd <A>[1]' },
      { id: 'b', title: 'World' },
    ];
    expect(
      validateCommandName(all, '  Cmd <A>[1]  ', 'a', { nameRequired: 'REQ', nameDuplicate: 'DUP', nameReservedChars: 'RES' }),
    ).toBe('RES');
    expect(
      validateCommandName(all, 'Cmd <A>[1]', 'x', { nameRequired: 'REQ', nameDuplicate: 'DUP', nameReservedChars: 'RES' }),
    ).toBe('RES');
    expect(
      validateCommandName(all, 'New <Cmd>[x]', 'x', { nameRequired: 'REQ', nameDuplicate: 'DUP', nameReservedChars: 'RES' }),
    ).toBe('RES');
  });
});

