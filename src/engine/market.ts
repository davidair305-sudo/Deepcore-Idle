import { getItem } from '../data/items';
import { HOME_COLONY, KITS, KIT_TRADER_RANK, getColony } from '../data/world';
import type { Outcome } from './contracts';
import { removeItem } from './inventory';
import { rankForRep } from './reputation';
import type { GameState } from './state';
import { unitValue } from './value';

// Instant ways to cash out (GDD "Economy"), plus the kit trader. There's no
// market buying in v0.1 (decision D3).

/** Broker (home only): 60% of value in credits, 20% as Authority reputation. */
export const BROKER_CREDIT_SHARE = 0.6;
export const BROKER_REP_SHARE = 0.2;
/** Donating (any colony): 20% of value in credits, 80% as that colony's reputation. */
export const DONATE_CREDIT_SHARE = 0.2;
export const DONATE_REP_SHARE = 0.8;

export interface CashOut {
  count: number;
  credits: number;
  rep: number;
}

/** Remove `count` units (worst quality first) and total their value. */
function take(s: GameState, item: string, count: number): number | null {
  getItem(item); // throws on unknown ids
  if (!Number.isInteger(count) || count < 1) return null;
  const taken = removeItem(s.inventory, item, count, 'lowest');
  if (!taken) return null;
  return Object.entries(taken).reduce((sum, [q, n]) => sum + unitValue(item, Number(q)) * n, 0);
}

export function sellToBroker(s: GameState, item: string, count: number): CashOut | null {
  if (!getColony(s.colony).hasBroker) return null;
  const value = take(s, item, count);
  if (value == null) return null;
  const out = { count, credits: value * BROKER_CREDIT_SHARE, rep: value * BROKER_REP_SHARE };
  s.credits += out.credits;
  s.rep[HOME_COLONY] += out.rep;
  return out;
}

export function donate(s: GameState, item: string, count: number): CashOut | null {
  const value = take(s, item, count);
  if (value == null) return null;
  const out = { count, credits: value * DONATE_CREDIT_SHARE, rep: value * DONATE_REP_SHARE };
  s.credits += out.credits;
  s.rep[s.colony] += out.rep;
  return out;
}

/** Kit trader: in the colony you're in, at rank 4 there. Kits can't be resold or donated. */
export function buyKit(s: GameState, kitId: string): Outcome {
  const kit = KITS.find((k) => k.id === kitId);
  if (!kit || kit.price <= 0) return { ok: false, reason: 'That kit isn’t sold' };
  if (rankForRep(s.rep[s.colony]) < KIT_TRADER_RANK) return { ok: false, reason: `The kit trader deals with rank ${KIT_TRADER_RANK} miners only` };
  if (s.kits.includes(kit.id)) return { ok: false, reason: 'You already own it' };
  if (s.credits < kit.price) return { ok: false, reason: 'Not enough credits' };
  s.credits -= kit.price;
  s.kits.push(kit.id);
  return { ok: true };
}
