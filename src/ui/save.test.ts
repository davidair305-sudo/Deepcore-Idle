import { describe, expect, it } from 'vitest';
import { addItem } from '../engine/inventory';
import { newGame } from '../engine/state';
import { SAVE_VERSION, decodeExport, encodeExport, normalizeState, parseSave, serialize } from './save';

describe('save files', () => {
  it('round-trips the current format', () => {
    const s = newGame();
    s.credits = 1234;
    addItem(s.inventory, 'copper', 13, 50);
    const text = serialize({ savedAt: 1000, state: s, log: [{ at: 1, text: 'hi', tone: 'good' }], settings: { tips: false, sound: true } });
    const r = parseSave(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.file.version).toBe(SAVE_VERSION);
    expect(r.file.state).toEqual(s);
    expect(r.file.settings.tips).toBe(false);
    expect(r.file.log[0]!.text).toBe('hi');
  });

  it('migrates untagged v1 saves from S4', () => {
    const s = newGame();
    s.credits = 99;
    const legacy = JSON.stringify({ savedAt: 5, state: s, log: [] });
    const r = parseSave(legacy);
    expect(r.ok && r.file.state.credits).toBe(99);
    expect(r.ok && r.file.settings).toEqual({ tips: true, sound: true });
  });

  it('fills fields missing from older states', () => {
    const old = { version: 1, xp: { mining: 500 }, credits: 10, inventory: { tin: { 20: 4 } } };
    const s = normalizeState(old);
    expect(s.xp).toEqual({ mining: 500, refining: 0, crafting: 0, trading: 0 });
    expect(s.oil).toEqual(newGame().oil);
    expect(s.stall).toEqual([]);
    expect(s.inventory).toEqual({ tin: { 20: 4 } });
  });

  it('drops damaged fields instead of crashing', () => {
    const s = normalizeState({
      credits: 'lots',
      colony: 'mars',
      inventory: { copper: { 0: 5, 50: -2, 30: 3.5, 40: 2 }, junk: 'x' },
      queue: [{ kind: 'teleport', target: 'x' }, { kind: 'mine', target: 'copper', durationMs: -1 }],
      queueSlots: 99,
    });
    expect(s.credits).toBe(0);
    expect(s.colony).toBe('authority');
    expect(s.inventory).toEqual({ copper: { 40: 2 } });
    expect(s.queue).toHaveLength(1);
    expect(s.queue[0]!.durationMs).toBeNull();
    expect(s.queueSlots).toBe(3);
  });

  it('refuses things that are not saves, or from a newer version', () => {
    expect(parseSave('not json').ok).toBe(false);
    expect(parseSave('[1,2]').ok).toBe(false);
    expect(parseSave('{"hello":1}').ok).toBe(false);
    expect(parseSave(JSON.stringify({ format: 'deepcore-save', version: SAVE_VERSION + 1, state: {} }))).toMatchObject({ ok: false });
  });

  it('exports and imports a text code, including non-ASCII log text', () => {
    const text = serialize({ savedAt: 1, state: newGame(), log: [{ at: 1, text: 'Miners’ Union — rank 2', tone: 'info' }], settings: { tips: true, sound: false } });
    const code = encodeExport(text);
    expect(code.startsWith('DEEPCORE:')).toBe(true);
    const r = decodeExport(`  ${code}\n`);
    expect(r.ok && r.file.log[0]!.text).toBe('Miners’ Union — rank 2');
    expect(decodeExport('DEEPCORE:@@@').ok).toBe(false);
    expect(decodeExport('hello').ok).toBe(false);
  });
});
