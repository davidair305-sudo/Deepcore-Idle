import { BARS, CRAFTABLES, ORES, getItem } from '../data/items';
import type { Bar, ColonyId, Craftable, Kit, Ore, SkillId } from '../data/types';
import { KITS, getColony } from '../data/world';
import { addItem, averageQualityOf, countItem, removeRecipe, type PickOrder } from './inventory';
import { npcBarQuality } from './qualityRules';
import { colonyFee } from './reputation';
import { mineKey, type ActionKind, type GameState, type QueueStep } from './state';
import { levelForXp } from './xp';

// Rates, requirements and queue management. The time loop lives in tick.ts.

export const MINE_TIME_MS = 3000;
export const REFINE_TIME_MS = 2000;
export const CRAFT_TIME_MS = 3000;
/** GDD "Shared rules": +5% per 30 min on the same step, max +25%, from skill level 10. */
export const MOMENTUM_STEP_MS = 30 * 60 * 1000;
export const MOMENTUM_PER_STEP = 0.05;
export const MOMENTUM_MAX_STEPS = 5;
export const MOMENTUM_MIN_LEVEL = 10;
/** GDD "Mine depletion": 2% yield lost per 30 min of use, up to 15%. */
export const DEPLETION_PER_MS = 0.02 / (30 * 60 * 1000);
export const DEPLETION_MAX = 0.15;
/** Prototype v9: unused mines recover 5% per 20 min. */
export const DEPLETION_RECOVERY_PER_MS = 0.05 / (20 * 60 * 1000);
/** Event effects. */
export const RICH_VEIN_YIELD = 1.5;
export const SLOWED_TIME = 1.25;
/** NPC refiner keeps 40% of the bars (GDD). */
export const NPC_KEEP_SHARE = 0.4;

const ORE_BY_ID = new Map(ORES.map((o) => [o.id, o]));
const BAR_BY_ID = new Map(BARS.map((b) => [b.id, b]));
const CRAFT_BY_ID = new Map(CRAFTABLES.map((c) => [c.id, c]));

export const getOre = (id: string): Ore | undefined => ORE_BY_ID.get(id);
export const getBar = (id: string): Bar | undefined => BAR_BY_ID.get(id);
export const getCraftable = (id: string): Craftable | undefined => CRAFT_BY_ID.get(id);

export const skillOf = (kind: ActionKind): SkillId =>
  kind === 'mine' ? 'mining' : kind === 'refine' ? 'refining' : 'crafting';

export const level = (s: GameState, skill: SkillId): number => levelForXp(s.xp[skill]);

export function equippedKit(s: GameState): Kit {
  const ml = level(s, 'mining');
  let best = KITS[0]!;
  for (const k of KITS) if (s.kits.includes(k.id) && k.miningLevel <= ml && k.yieldMultiplier > best.yieldMultiplier) best = k;
  return best;
}

export function momentum(s: GameState): number {
  const step = s.queue[0];
  if (!step || level(s, skillOf(step.kind)) < MOMENTUM_MIN_LEVEL) return 1;
  return 1 + MOMENTUM_PER_STEP * Math.min(MOMENTUM_MAX_STEPS, Math.floor(s.momentumMs / MOMENTUM_STEP_MS));
}

export function actionTimeMs(s: GameState, step: QueueStep): number {
  switch (step.kind) {
    case 'mine':
      return MINE_TIME_MS * (s.buffs.slowed > 0 ? SLOWED_TIME : 1);
    case 'refine':
      return REFINE_TIME_MS / (1 + 0.02 * (level(s, 'refining') - 1));
    case 'craft':
      return CRAFT_TIME_MS / (1 + 0.02 * (level(s, 'crafting') - 1));
  }
}

/** Kept ore per mining action (after fee), before the rich-vein event bonus. */
export function keptOrePerAction(s: GameState, colony: ColonyId, ore: Ore): number {
  const gross =
    ore.yield *
    (1 + 0.02 * (level(s, 'mining') - 1)) *
    equippedKit(s).yieldMultiplier *
    momentum(s) *
    (1 - (s.depletion[mineKey(colony, ore.id)] ?? 0));
  return gross * (1 - colonyFee(colony, s.rep[colony]));
}

/** Why a step can't run right now, or null if it can. */
export function blockReason(s: GameState, step: QueueStep): string | null {
  const colony = getColony(step.colony);
  if (step.kind === 'mine') {
    const ore = getOre(step.target);
    if (!ore) return `${step.target} isn't an ore`;
    if (!colony.ores.includes(ore.id)) return `${ore.name} isn't mined at ${colony.shortName}`;
    if (level(s, 'mining') < ore.miningLevel) return `Needs Mining ${ore.miningLevel}`;
    return null;
  }
  if (step.kind === 'refine') {
    const bar = getBar(step.target);
    if (!bar) return `${step.target} isn't a bar`;
    if (!colony.bars.includes(bar.id)) return `${bar.name} isn't refined at ${colony.shortName}`;
    if (level(s, 'refining') < bar.refiningLevel) return `Needs Refining ${bar.refiningLevel}`;
    if (!hasInputs(s, bar.recipe)) return `Out of materials for ${bar.name}`;
    return null;
  }
  const item = getCraftable(step.target);
  if (!item) return `${step.target} isn't craftable`;
  if (level(s, 'crafting') < item.craftingLevel) return `Needs Crafting ${item.craftingLevel}`;
  if (!hasInputs(s, item.recipe)) return `Out of materials for ${item.name}`;
  return null;
}

const hasInputs = (s: GameState, recipe: Readonly<Record<string, number>>): boolean =>
  Object.entries(recipe).every(([id, n]) => countItem(s.inventory, id) >= n);

export interface StepInput {
  kind: ActionKind;
  target: string;
  colony?: ColonyId;
  amount?: number | null;
  pick?: PickOrder;
}

function makeStep(s: GameState, input: StepInput): QueueStep {
  if (input.amount != null && (!Number.isInteger(input.amount) || input.amount < 1)) throw new Error(`Bad amount: ${input.amount}`);
  return {
    kind: input.kind,
    target: input.target,
    colony: input.colony ?? s.colony,
    amount: input.amount ?? null,
    pick: input.pick ?? 'lowest',
    done: 0,
  };
}

function resetCurrent(s: GameState): void {
  s.progressMs = 0;
  s.momentumMs = 0;
}

/** Replace the whole queue with one step and start it now. */
export function startAction(s: GameState, input: StepInput): void {
  s.queue = [makeStep(s, input)];
  resetCurrent(s);
}

/** Add a step to the end of the queue. Returns false if every slot is taken. */
export function enqueue(s: GameState, input: StepInput): boolean {
  if (s.queue.length >= s.queueSlots) return false;
  s.queue.push(makeStep(s, input));
  if (s.queue.length === 1) resetCurrent(s);
  return true;
}

/** Remove a queued step by position. Removing the running step starts the next one fresh. */
export function removeStep(s: GameState, index: number): void {
  if (index < 0 || index >= s.queue.length) return;
  s.queue.splice(index, 1);
  if (index === 0) resetCurrent(s);
}

export function stopAll(s: GameState): void {
  s.queue = [];
  resetCurrent(s);
}

/** Finish the running step and move to the next (momentum resets on a switch). */
export function advanceQueue(s: GameState): void {
  s.queue.shift();
  resetCurrent(s);
}

/**
 * NPC refiner (GDD): refines every set of inputs instantly, keeps 40% of the
 * bars, gives no XP, and pours at 70% of input quality. Returns bars received.
 */
export function npcRefineAll(s: GameState, barId: string, pick: PickOrder = 'lowest'): number {
  const bar = getBar(barId);
  if (!bar || !getColony(s.colony).bars.includes(bar.id)) return 0;
  const sets = Math.min(...Object.entries(bar.recipe).map(([id, n]) => Math.floor(countItem(s.inventory, id) / n)));
  if (sets < 1) return 0;
  const taken = removeRecipe(s.inventory, bar.recipe, sets, pick)!;
  const received = Math.floor(sets * (1 - NPC_KEEP_SHARE));
  addItem(s.inventory, bar.id, npcBarQuality(averageQualityOf(Object.values(taken))), received);
  return received;
}

/** Display name for any step target. */
export const targetName = (step: Pick<QueueStep, 'target'>): string => getItem(step.target).name;
