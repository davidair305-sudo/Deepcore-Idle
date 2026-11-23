import type { Rng } from './rng';
import type { GameState } from './state';
import { advance, type AdvanceResult } from './tick';

// GDD "Offline progress": the first 24 hours count fully, the next 48 at
// half, nothing after 72 hours. Dev speed settings never apply here (PLAN.md A2).

const HOUR = 60 * 60 * 1000;
export const FULL_OFFLINE_MS = 24 * HOUR;
export const HALF_OFFLINE_MS = 48 * HOUR;

/** Game time earned for a real time away. */
export function effectiveOfflineMs(awayMs: number): number {
  const away = Math.max(0, awayMs);
  const full = Math.min(away, FULL_OFFLINE_MS);
  const half = Math.min(Math.max(away - FULL_OFFLINE_MS, 0), HALF_OFFLINE_MS);
  return full + half / 2;
}

export interface OfflineResult extends AdvanceResult {
  awayMs: number;
  effectiveMs: number;
}

export function applyOffline(s: GameState, awayMs: number, rng: Rng): OfflineResult {
  const effectiveMs = effectiveOfflineMs(awayMs);
  return { ...advance(s, effectiveMs, rng), awayMs: Math.max(0, awayMs), effectiveMs };
}
