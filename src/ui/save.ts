import type { ColonyId, SkillId } from '../data/types';
import { COLONIES } from '../data/world';
import { newGame, type ActionKind, type GameState } from '../engine/state';

// Save files (PLAN.md A3): versioned, migrated forward, validated field by
// field so a damaged or old save can't crash the game. Pure functions only;
// store.ts does the actual localStorage reads and writes.

export const SAVE_FORMAT = 'deepcore-save';
/** v1: S4 saves ({ savedAt, state, log }, no format tag). v2: tagged, with settings. */
export const SAVE_VERSION = 2;
export const EXPORT_PREFIX = 'DEEPCORE:';

export interface LogEntry {
  at: number;
  text: string;
  tone: 'good' | 'bad' | 'info';
}

export interface Settings {
  /** Show the next-goal coach card. */
  tips: boolean;
  /** Level-up sounds on the return screen. */
  sound: boolean;
}

export const defaultSettings = (): Settings => ({ tips: true, sound: true });

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  version: number;
  savedAt: number;
  state: GameState;
  log: LogEntry[];
  settings: Settings;
}

export type ParseResult = { ok: true; file: SaveFile } | { ok: false; reason: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Rebuild a GameState from untrusted data, keeping only fields that look right. */
export function normalizeState(raw: unknown): GameState {
  const s = newGame();
  if (!isObj(raw)) return s;
  if (isObj(raw.xp)) for (const k of Object.keys(s.xp) as SkillId[]) s.xp[k] = Math.max(0, num(raw.xp[k], 0));
  s.credits = Math.max(0, num(raw.credits, 0));
  if (isObj(raw.rep)) for (const k of Object.keys(s.rep) as ColonyId[]) s.rep[k] = Math.max(0, num(raw.rep[k], 0));
  if (typeof raw.colony === 'string' && COLONIES.some((c) => c.id === raw.colony)) s.colony = raw.colony as ColonyId;
  if (isObj(raw.inventory))
    for (const [item, stacks] of Object.entries(raw.inventory)) {
      if (!isObj(stacks)) continue;
      const clean: Record<number, number> = {};
      for (const [q, n] of Object.entries(stacks)) {
        const qq = Number(q);
        if (Number.isInteger(qq) && qq >= 1 && qq <= 100 && Number.isInteger(n) && (n as number) > 0) clean[qq] = n as number;
      }
      if (Object.keys(clean).length) s.inventory[item] = clean;
    }
  if (Array.isArray(raw.kits)) s.kits = [...new Set(['starterKit', ...raw.kits.filter((k): k is string => typeof k === 'string')])];
  const kinds: ActionKind[] = ['mine', 'refine', 'craft', 'sell'];
  if (Array.isArray(raw.queue))
    s.queue = raw.queue
      .filter((q): q is Record<string, unknown> => isObj(q) && kinds.includes(q.kind as ActionKind) && typeof q.target === 'string')
      .map((q) => ({
        kind: q.kind as ActionKind,
        target: q.target as string,
        colony: COLONIES.some((c) => c.id === q.colony) ? (q.colony as ColonyId) : s.colony,
        durationMs: typeof q.durationMs === 'number' && q.durationMs > 0 ? q.durationMs : null,
        pick: q.pick === 'highest' ? 'highest' : 'lowest',
        elapsedMs: Math.max(0, num(q.elapsedMs, 0)),
        done: Math.max(0, num(q.done, 0)),
      }));
  s.queueSlots = Math.max(1, Math.min(3, Math.floor(num(raw.queueSlots, 1))));
  s.progressMs = Math.max(0, num(raw.progressMs, 0));
  s.momentumMs = Math.max(0, num(raw.momentumMs, 0));
  for (const key of ['depletion', 'oreCarry'] as const)
    if (isObj(raw[key])) for (const [k, v] of Object.entries(raw[key] as object)) if (typeof v === 'number' && Number.isFinite(v)) s[key][k] = v;
  if (isObj(raw.buffs)) s.buffs = { richVein: Math.max(0, num(raw.buffs.richVein, 0)), slowed: Math.max(0, num(raw.buffs.slowed, 0)) };
  if (Array.isArray(raw.stall))
    s.stall = raw.stall
      .filter((w): w is Record<string, unknown> => isObj(w) && typeof w.item === 'string')
      .slice(0, 6)
      .map((w) => ({ item: w.item as string, price: Math.max(0.25, Math.min(3, num(w.price, 1))), pick: w.pick === 'highest' ? 'highest' : 'lowest' }));
  if (isObj(raw.oil))
    s.oil = {
      step: Math.max(0, Math.floor(num(raw.oil.step, 0))),
      sales: Math.max(0, num(raw.oil.sales, 0)),
      token: raw.oil.token === true,
      hangar: raw.oil.hangar === true,
      oilDepot: raw.oil.oilDepot === true,
    };
  if (isObj(raw.boards)) s.boards = raw.boards as GameState['boards'];
  return s;
}

function normalizeLog(raw: unknown): LogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => isObj(e) && typeof e.text === 'string')
    .slice(0, 60)
    .map((e) => ({ at: num(e.at, 0), text: e.text as string, tone: e.tone === 'good' || e.tone === 'bad' ? e.tone : 'info' }));
}

/** Parse any save we've ever written (or an export code) into the current format. */
export function parseSave(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'That save is damaged (not valid data).' };
  }
  if (!isObj(raw)) return { ok: false, reason: 'That isn’t a Deepcore save.' };
  let version: number;
  if (raw.format === SAVE_FORMAT) version = num(raw.version, 0);
  else if (isObj(raw.state) && 'savedAt' in raw) version = 1; // S4 saves had no format tag
  else return { ok: false, reason: 'That isn’t a Deepcore save.' };
  if (version > SAVE_VERSION) return { ok: false, reason: 'That save is from a newer version of the game. Refresh to update first.' };
  if (version < 1) return { ok: false, reason: 'That save’s version is unknown.' };
  // Migrations run in order; v1 → v2 only adds the tag and settings, handled by normalising below.
  return {
    ok: true,
    file: {
      format: SAVE_FORMAT,
      version: SAVE_VERSION,
      savedAt: num(raw.savedAt, Date.now()),
      state: normalizeState(raw.state),
      log: normalizeLog(raw.log),
      settings: { ...defaultSettings(), ...(isObj(raw.settings) ? { tips: raw.settings.tips !== false, sound: raw.settings.sound !== false } : {}) },
    },
  };
}

export function serialize(file: Omit<SaveFile, 'format' | 'version'>): string {
  return JSON.stringify({ format: SAVE_FORMAT, version: SAVE_VERSION, ...file });
}

/** A copy-pasteable code: prefix + base64 of the save JSON. */
export function encodeExport(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return EXPORT_PREFIX + btoa(bin);
}

export function decodeExport(code: string): ParseResult {
  const t = code.trim();
  if (!t.startsWith(EXPORT_PREFIX)) return t.startsWith('{') ? parseSave(t) : { ok: false, reason: 'That code doesn’t start with DEEPCORE:' };
  try {
    const bin = atob(t.slice(EXPORT_PREFIX.length).replace(/\s+/g, ''));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    return parseSave(json);
  } catch {
    return { ok: false, reason: 'That code is damaged or incomplete.' };
  }
}
