import { getItem } from '../data/items';
import { targetName } from '../engine/actions';
import { applyOffline } from '../engine/offline';
import type { Rng } from '../engine/rng';
import { newGame, type GameState } from '../engine/state';
import { advance, type GameEvent } from '../engine/tick';

// The UI's side of the game: owns the one GameState, the real clock and real
// randomness, saving, and the ops log. The engine stays pure (CLAUDE.md).
// S5 replaces the simple save here with versioned saves, export/import and backups.

const SAVE_KEY = 'deepcore.save';
const LOG_MAX = 60;

export interface LogEntry {
  at: number;
  text: string;
  tone: 'good' | 'bad' | 'info';
}

export interface Saved {
  savedAt: number;
  state: GameState;
  log: LogEntry[];
}

export const rng: Rng = Math.random;

export const store = {
  state: newGame(),
  log: [] as LogEntry[],
  /** Set after loading when time passed while away; shown until dismissed (the full return screen is S5). */
  away: null as null | { awayMs: number; effectiveMs: number; events: GameEvent[]; before: GameState },
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
    if (d) addLog(d.text, d.tone);
  }
}

export function save(): void {
  const data: Saved = { savedAt: Date.now(), state: store.state, log: store.log };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be blocked (private mode); the game still runs, it just won't persist.
  }
}

export function load(now = Date.now()): void {
  let data: Saved | null = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    data = raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    data = null;
  }
  if (!data?.state || data.state.version !== 1) return;
  // Fill in any fields added since the save was written.
  store.state = { ...newGame(), ...data.state };
  store.log = Array.isArray(data.log) ? data.log : [];
  const awayMs = now - data.savedAt;
  if (awayMs > 60_000 && store.state.queue.length > 0) {
    const before = structuredClone(store.state);
    const r = applyOffline(store.state, awayMs, rng);
    logEvents(r.events);
    store.away = { awayMs: r.awayMs, effectiveMs: r.effectiveMs, events: r.events, before };
  }
}

export function resetGame(): void {
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
