import { BARS, CRAFTABLES, ORES, getItem } from '../data/items';
import type { ColonyId } from '../data/types';
import { COLONIES, HOME_COLONY, KITS, OIL_CHAIN } from '../data/world';
import {
  CRAFT_TIME_MS,
  MINE_TIME_MS,
  REFINE_TIME_MS,
  enqueue,
  getBar,
  getCraftable,
  getOre,
  keptOrePerAction,
  level,
  stopAll,
  type StepInput,
} from '../engine/actions';
import { boardFor, currentOilStep, deliverContract, turnInOilStep } from '../engine/contracts';
import { countItem } from '../engine/inventory';
import { buyKit, donate } from '../engine/market';
import { colonyFee, rankForRep } from '../engine/reputation';
import { listWare } from '../engine/stall';
import type { GameState } from '../engine/state';

// A heuristic player who checks in twice a day (PLAN.md decision D5). At each
// check-in it hands in what it can, donates its output for reputation, and
// queues up the next 12 hours with the slots it has. It isn't optimal; it's a
// reasonable, repeatable player so pacing changes show up as numbers.

/** Queue slots by progress. Stand-in for the Shift Scheduler and Nav Computer until S7 builds them. */
export function simQueueSlots(s: GameState): number {
  if (rankForRep(s.rep[HOME_COLONY]) >= 5) return 3; // ~week 1: Nav Computer
  if (s.oil.step >= 3) return 2; // ~day 2: Shift Scheduler
  return 1;
}

/** Ores per unit of an item, expanding bar recipes (gems are skipped). */
function oresPer(item: string, out: Map<string, number> = new Map(), mult = 1): Map<string, number> {
  if (getOre(item)) out.set(item, (out.get(item) ?? 0) + mult);
  const recipe = getBar(item)?.recipe ?? getCraftable(item)?.recipe;
  if (recipe) for (const [id, n] of Object.entries(recipe)) oresPer(id, out, mult * n);
  return out;
}

const hasGemInput = (item: string): boolean => {
  const recipe = getBar(item)?.recipe ?? getCraftable(item)?.recipe ?? {};
  return Object.keys(recipe).some((id) => id === 'roughGem' || id === 'polishedGem' || hasGemInput(id));
};

/** Colony with the lowest fee that mines this ore. */
function bestMine(s: GameState, ore: string): ColonyId {
  const options = COLONIES.filter((c) => c.ores.includes(ore));
  return options.reduce((a, b) => (colonyFee(b.id, s.rep[b.id]) < colonyFee(a.id, s.rep[a.id]) ? b : a)).id;
}

const refineColony = (bar: string): ColonyId => {
  const home = COLONIES.find((c) => c.id === HOME_COLONY)!;
  return home.bars.includes(bar) ? HOME_COLONY : COLONIES.find((c) => c.bars.includes(bar))!.id;
};

/** Ms of mining per kept ore at today's rates. */
function mineMsPerOre(s: GameState, ore: string): number {
  return MINE_TIME_MS / keptOrePerAction(s, bestMine(s, ore), getOre(ore)!);
}

/** Total player time to make one unit from scratch. */
function msPerUnit(s: GameState, item: string): number {
  let ms = 0;
  for (const [ore, n] of oresPer(item)) ms += n * mineMsPerOre(s, ore);
  const walk = (id: string, mult: number): void => {
    const bar = getBar(id);
    const craft = getCraftable(id);
    if (bar) ms += (mult * REFINE_TIME_MS) / (1 + 0.02 * (level(s, 'refining') - 1));
    if (craft) ms += (mult * CRAFT_TIME_MS) / (1 + 0.02 * (level(s, 'crafting') - 1));
    for (const [sub, n] of Object.entries(bar?.recipe ?? craft?.recipe ?? {})) walk(sub, mult * n);
  };
  walk(item, 1);
  return ms;
}

function canMake(s: GameState, item: string): boolean {
  if (hasGemInput(item)) return false;
  for (const ore of oresPer(item).keys()) if (level(s, 'mining') < getOre(ore)!.miningLevel) return false;
  const ok = (id: string): boolean => {
    const bar = getBar(id);
    const craft = getCraftable(id);
    if (bar && level(s, 'refining') < bar.refiningLevel) return false;
    if (craft && level(s, 'crafting') < craft.craftingLevel) return false;
    return Object.keys(bar?.recipe ?? craft?.recipe ?? {}).every(ok);
  };
  return ok(item);
}

/** What to work toward: an oil chain delivery, or the best value per hour. */
export function chooseGoal(s: GameState): { item: string; units: number | null } {
  const step = currentOilStep(s);
  if (step?.deliver) {
    for (const [id, n] of Object.entries(step.deliver)) {
      const short = n - countItem(s.inventory, id);
      if (short > 0 && canMake(s, id)) return { item: id, units: short };
    }
    // Can't make what's needed yet (e.g. steel plating before Refining 15): train toward it.
  }
  const candidates = [...ORES.map((o) => o.id), ...BARS.map((b) => b.id), ...CRAFTABLES.map((c) => c.id)].filter((id) => canMake(s, id));
  let best = candidates[0]!;
  let bestRate = 0;
  for (const id of candidates) {
    const rate = getItem(id).value / msPerUnit(s, id);
    if (rate > bestRate) {
      best = id;
      bestRate = rate;
    }
  }
  return { item: best, units: null };
}

/** Steps to make `units` of an item, using stock first. Mining steps get time limits. */
export function planSteps(s: GameState, item: string, units: number): StepInput[] {
  const stock = new Map<string, number>();
  const avail = (id: string): number => stock.get(id) ?? countItem(s.inventory, id);
  const mined = new Map<string, number>();
  const bars: string[] = [];
  const crafts: string[] = [];
  const need = (id: string, n: number): void => {
    const use = Math.min(avail(id), n);
    stock.set(id, avail(id) - use);
    const rest = n - use;
    if (rest <= 0) return;
    if (getOre(id)) return void mined.set(id, (mined.get(id) ?? 0) + rest);
    const bar = getBar(id);
    const craft = getCraftable(id);
    const recipe = bar?.recipe ?? craft?.recipe ?? {};
    for (const [sub, k] of Object.entries(recipe)) need(sub, rest * k);
    // Dependencies first: a bar's own inputs are planned before it.
    if (bar && !bars.includes(id)) bars.push(id);
    if (craft && !crafts.includes(id)) crafts.push(id);
  };
  need(item, units);
  const steps: StepInput[] = [];
  for (const [ore, n] of mined) steps.push({ kind: 'mine', target: ore, colony: bestMine(s, ore), durationMs: Math.max(60_000, n * mineMsPerOre(s, ore)) });
  for (const bar of bars) steps.push({ kind: 'refine', target: bar, colony: refineColony(bar) });
  for (const c of crafts) steps.push({ kind: 'craft', target: c });
  return steps;
}

export const CHECK_IN_MS = 12 * 60 * 60 * 1000;

/** Everything a player does at one check-in. */
export function checkIn(s: GameState, now: number): void {
  s.queueSlots = simQueueSlots(s);
  // Hand in the oil chain and contracts wherever possible (colonies switch freely).
  s.colony = HOME_COLONY;
  while (turnInOilStep(s).ok);
  for (const c of COLONIES) {
    s.colony = c.id;
    boardFor(s, c.id, now).offers.forEach((_, i) => deliverContract(s, c.id, i, now));
  }
  s.colony = HOME_COLONY;

  // Kits: buy the next one once it's usable and affordable (rank 4 at home).
  for (const k of KITS) if (!s.kits.includes(k.id) && k.price > 0 && level(s, 'mining') >= k.miningLevel && s.credits >= k.price) buyKit(s, k.id);

  const goal = chooseGoal(s);
  const keep = new Set<string>([goal.item, ...oresPer(goal.item).keys(), ...Object.keys(currentOilStep(s)?.deliver ?? {})]);
  const addInputs = (id: string): void => {
    for (const sub of Object.keys(getBar(id)?.recipe ?? getCraftable(id)?.recipe ?? {})) {
      keep.add(sub);
      addInputs(sub);
    }
  };
  addInputs(goal.item);
  for (const id of Object.keys(currentOilStep(s)?.deliver ?? {})) addInputs(id);

  const salesStep = OIL_CHAIN[s.oil.step]?.salesValue != null;
  const steps: StepInput[] = [];
  if (salesStep) {
    // "Open for business": sell output at market price instead of donating it.
    s.stall = [];
    for (const id of Object.keys(s.inventory)) if (!keep.has(id) || id === goal.item) listWare(s, id);
    steps.push({ kind: 'sell', target: '' });
  } else {
    // Donate everything that isn't an input for current work: reputation is the gate.
    for (const id of Object.keys(s.inventory)) if (!keep.has(id) || id === goal.item) donate(s, id, countItem(s.inventory, id));
  }

  const units = goal.units ?? Math.max(1, Math.floor(CHECK_IN_MS / msPerUnit(s, goal.item)));
  steps.push(...planSteps(s, goal.item, units));

  stopAll(s);
  const taken = steps.slice(0, s.queueSlots);
  // A final mining step has nothing after it, so it can run until the next check-in.
  const last = taken[taken.length - 1];
  if (last?.kind === 'mine') taken[taken.length - 1] = { ...last, durationMs: null };
  for (const st of taken) {
    s.colony = st.colony ?? HOME_COLONY;
    enqueue(s, st);
  }
  s.colony = HOME_COLONY;
}
