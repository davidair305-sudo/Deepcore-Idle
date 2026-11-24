import { getItem } from '../data/items';
import { targetName } from '../engine/actions';
import { applyOffline } from '../engine/offline';
import type { Rng } from '../engine/rng';
import { newGame, type GameState } from '../engine/state';
import { advance, type AdvanceResult, type GameEvent } from '../engine/tick';
import { decodeExport, defaultSettings, encodeExport, parseSave, serialize, type LogEntry, type SaveFile, type Settings } from './save';

// The UI's side of the game: owns the one GameState, the real clock and real
// randomness, saving, and the ops log. The engine stays pure (CLAUDE.md).

export type { LogEntry } from './save';

const SAVE_KEY = 'deepcore.save';
const BACKUP_KEY = 'deepcore.save.backup';
/** The backup slot is refreshed at most this often, so it lags the main save. */
const BACKUP_EVERY_MS = 30 * 60 * 1000;
const LOG_MAX = 60;

export const rng: Rng = Math.random;

export interface Away {
  awayMs: number;
  effectiveMs: number;
  result: AdvanceResult;
  before: GameState;
  /** Where the running action was when the player left. */
  colony: GameState['colony'];
}

export const store = {
  state: newGame(),
  log: [] as LogEntry[],
  settings: defaultSettings() as Settings,
  /** Set after time away; drives the return screen until collected. */
  away: null as Away | null,
  lastSaved: 0,
  lastBackup: 0,
  /** A message for the player about loading (e.g. restored from backup). */
  notice: '' as string,
};

export function addLog(text: string, tone: LogEntry['tone'] = 'info', at = Date.now()): void {
  store.log.unshift({ at, text, tone });
  if (store.log.length > LOG_MAX) store.log.length = LOG_MAX;
}

export function describeEvent(e: GameEvent): { text: string; tone: LogEntry['tone'] } {
  switch (e.type) {
    case 'levelUp':
      return { text: `${e.skill[0]!.toUpperCase()}${e.skill.slice(1)} level ${e.level}!`, tone: 'good' };
    case 'stepDone':
      return { text: `Queue: ${targetName(e)} done (${e.made} made)`, tone: 'info' };
    case 'stepStopped':
      return { text: `Queue: ${targetName(e)} stopped. ${e.reason}`, tone: 'bad' };
    case 'random':
      return { text: e.event.text, tone: e.event.good ? 'good' : 'bad' };
    case 'gem':
      return { text: `Found a ${getItem('roughGem').name.toLowerCase()} (quality ${e.quality})`, tone: 'good' };
  }
}

export function logEvents(events: GameEvent[]): void {
  // Gems are common (1–3% of mining actions): summarise them instead of one line each.
  const gems = events.filter((e) => e.type === 'gem').length;
  if (gems) addLog(`Found ${gems} rough gem${gems > 1 ? 's' : ''}`, 'good');
  for (const e of events) {
    if (e.type === 'gem') continue;
    const d = describeEvent(e);
    addLog(d.text, d.tone);
  }
}

function currentSaveText(now = Date.now()): string {
  return serialize({ savedAt: now, state: store.state, log: store.log, settings: store.settings });
}

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked (private mode) or full; the game still runs, it just won't persist.
  }
};

export function save(now = Date.now()): void {
  const text = currentSaveText(now);
  write(SAVE_KEY, text);
  store.lastSaved = now;
  if (now - store.lastBackup > BACKUP_EVERY_MS) {
    write(BACKUP_KEY, text);
    store.lastBackup = now;
  }
}

/** Run time away through the engine and set up the return screen. */
export function applyAway(awayMs: number): void {
  const before = structuredClone(store.state);
  const colony = store.state.queue[0]?.colony ?? store.state.colony;
  const r = applyOffline(store.state, awayMs, rng);
  logEvents(r.events);
  if (r.actions > 0 || r.events.length > 0) store.away = { awayMs: r.awayMs, effectiveMs: r.effectiveMs, result: r, before, colony };
}

function adopt(file: SaveFile, now: number): void {
  store.state = file.state;
  store.log = file.log;
  store.settings = file.settings;
  store.lastBackup = now; // don't overwrite the backup on the first save after loading
  const awayMs = now - file.savedAt;
  if (awayMs > 60_000 && store.state.queue.length > 0) applyAway(awayMs);
}

export function load(now = Date.now()): void {
  const main = read(SAVE_KEY);
  if (!main) return;
  const r = parseSave(main);
  if (r.ok) return adopt(r.file, now);
  // The main save is damaged: fall back to the backup slot.
  const backup = read(BACKUP_KEY);
  const b = backup ? parseSave(backup) : null;
  if (b?.ok) {
    adopt(b.file, now);
    store.notice = 'Your save was damaged, so the game loaded your backup from earlier.';
  } else {
    store.notice = `Your save couldn't be loaded (${r.reason}). Starting fresh; the old data is kept in your browser in case you need it.`;
    write(`${SAVE_KEY}.damaged`, main);
  }
}

export function backupInfo(): { savedAt: number } | null {
  const b = read(BACKUP_KEY);
  const r = b ? parseSave(b) : null;
  return r?.ok ? { savedAt: r.file.savedAt } : null;
}

export function restoreBackup(now = Date.now()): string | null {
  const b = read(BACKUP_KEY);
  const r = b ? parseSave(b) : null;
  if (!r?.ok) return 'There is no backup to restore.';
  store.away = null;
  adopt(r.file, now);
  save(now);
  return null;
}

export const exportCode = (): string => encodeExport(currentSaveText());

/** Replace the game with an exported save. Returns an error message, or null on success. */
export function importCode(code: string, now = Date.now()): string | null {
  const r = decodeExport(code);
  if (!r.ok) return r.reason;
  write(BACKUP_KEY, currentSaveText(now)); // keep what we had, in case the import was a mistake
  store.away = null;
  adopt({ ...r.file, savedAt: now }, now); // imported saves don't grant time away
  save(now);
  return null;
}

export function resetGame(): void {
  write(BACKUP_KEY, currentSaveText());
  store.state = newGame();
  store.log = [];
  store.away = null;
  save();
}

/** Run the game forward by real elapsed time. Returns true if anything notable happened. */
export function tick(ms: number): boolean {
  const r = advance(store.state, ms, rng);
  logEvents(r.events);
  return r.events.length > 0;
}
