import { BARS, ORES, getItem } from '../data/items';
import type { ColonyId } from '../data/types';
import { HOME_COLONY, OIL_CHAIN, getColony, type OilStep } from '../data/world';
import { countItem, removeItem } from './inventory';
import { seededRng } from './rng';
import type { Contract, ContractBoard, GameState } from './state';
import { levelForXp } from './xp';

// Task boards (GDD "Contracts"): the Authority's oil depot story chain, plus
// repeatable mining and refinery contracts in every colony. Everything a
// player delivers is self-made now that market buying is gone (decision D3).

export type Outcome = { ok: true } | { ok: false; reason: string };
const fail = (reason: string): Outcome => ({ ok: false, reason });

// ---------- Oil depot chain ----------

export const currentOilStep = (s: GameState): OilStep | null => OIL_CHAIN[s.oil.step] ?? null;

/** Index of the "Open for business" step, whose stall sales count toward the token. */
const SALES_STEP = OIL_CHAIN.findIndex((st) => st.salesValue != null);

/** Called on every stall sale. Only sales made during the sales step count. */
export function recordSale(s: GameState, credits: number): void {
  if (s.oil.step === SALES_STEP) s.oil.sales += credits;
}

/** Why the current oil step can't be turned in yet, or null if it can. */
export function oilBlockReason(s: GameState): string | null {
  const step = currentOilStep(s);
  if (!step) return 'The oil depot chain is finished';
  if (s.colony !== HOME_COLONY) return `Turn in at the ${getColony(HOME_COLONY).name}`;
  for (const [id, n] of Object.entries(step.deliver ?? {})) {
    const have = countItem(s.inventory, id);
    if (have < n) return `Need ${n - have} more ${getItem(id).name}`;
  }
  if (step.salesValue != null && s.oil.sales < step.salesValue)
    return `Sell ${Math.ceil(step.salesValue - s.oil.sales).toLocaleString('en-US')} more credits of goods at your stall`;
  if (step.handInToken && !s.oil.token) return 'You need the depot token';
  return null;
}

export function turnInOilStep(s: GameState): Outcome {
  const reason = oilBlockReason(s);
  if (reason) return fail(reason);
  const step = currentOilStep(s)!;
  // Deliver the worst units first, so players keep their best materials.
  for (const [id, n] of Object.entries(step.deliver ?? {})) removeItem(s.inventory, id, n, 'lowest');
  if (step.handInToken) s.oil.token = false;
  const r = step.reward;
  if (r.rep) s.rep[HOME_COLONY] += r.rep;
  if (r.credits) s.credits += r.credits;
  if (r.xp) s.xp[r.xp.skill] += r.xp.amount;
  if (r.kit && !s.kits.includes(r.kit)) s.kits.push(r.kit);
  if (r.token) s.oil.token = true;
  if (r.hangar) s.oil.hangar = true;
  if (r.oilDepot) s.oil.oilDepot = true;
  s.oil.step++;
  return { ok: true };
}

// ---------- Repeatable contracts ----------

export const CONTRACT_WINDOW_MS = 8 * 60 * 60 * 1000;
export const CONTRACTS_PER_BOARD = 3;
export const ORE_CONTRACT_AMOUNT = 300;
export const BAR_CONTRACT_AMOUNT = 100;
/** Reward: 130% of the goods' value in credits, plus 80% of the value as reputation. */
export const CONTRACT_CREDIT_SHARE = 1.3;
export const CONTRACT_REP_SHARE = 0.8;

export const windowAt = (now: number): number => Math.floor(now / CONTRACT_WINDOW_MS);

/** Ms until the next board is posted. */
export const msToNextBoard = (now: number): number => CONTRACT_WINDOW_MS - (now % CONTRACT_WINDOW_MS);

function generateOffers(s: GameState, colony: ColonyId, window: number): Contract[] {
  const c = getColony(colony);
  const ml = levelForXp(s.xp.mining);
  const rl = levelForXp(s.xp.refining);
  // Only things the player can already make there.
  const pool: [string, number][] = [
    ...ORES.filter((o) => c.ores.includes(o.id) && o.miningLevel <= ml).map((o): [string, number] => [o.id, ORE_CONTRACT_AMOUNT]),
    ...BARS.filter((b) => c.bars.includes(b.id) && b.refiningLevel <= rl).map((b): [string, number] => [b.id, BAR_CONTRACT_AMOUNT]),
  ];
  const rng = seededRng(window * 7919 + c.id.length * 104729 + c.id.charCodeAt(0));
  const offers: Contract[] = [];
  while (offers.length < CONTRACTS_PER_BOARD && pool.length > 0) {
    const [item, amount] = pool.splice(Math.floor(rng() * pool.length), 1)[0]!;
    const value = getItem(item).value * amount;
    offers.push({ item, amount, credits: Math.round(value * CONTRACT_CREDIT_SHARE), rep: Math.round(value * CONTRACT_REP_SHARE), done: false });
  }
  return offers;
}

/** The colony's board for the current window, posting a new one if the window changed. */
export function boardFor(s: GameState, colony: ColonyId, now: number): ContractBoard {
  const window = windowAt(now);
  const existing = s.boards[colony];
  if (existing && existing.window === window) return existing;
  const board: ContractBoard = { window, offers: generateOffers(s, colony, window) };
  s.boards[colony] = board;
  return board;
}

export function deliverContract(s: GameState, colony: ColonyId, index: number, now: number): Outcome {
  if (s.colony !== colony) return fail(`Deliver at ${getColony(colony).name}`);
  const offer = boardFor(s, colony, now).offers[index];
  if (!offer) return fail('No such contract');
  if (offer.done) return fail('Already delivered');
  const have = countItem(s.inventory, offer.item);
  if (have < offer.amount) return fail(`Need ${offer.amount - have} more ${getItem(offer.item).name}`);
  removeItem(s.inventory, offer.item, offer.amount, 'lowest');
  s.credits += offer.credits;
  s.rep[colony] += offer.rep;
  offer.done = true;
  return { ok: true };
}
