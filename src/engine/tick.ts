import type { Ore, SkillId } from '../data/types';
import { ROUGH_GEM, gemChance } from '../data/items';
import {
  DEPLETION_MAX,
  DEPLETION_PER_MS,
  DEPLETION_RECOVERY_PER_MS,
  RICH_VEIN_YIELD,
  actionTimeMs,
  advanceQueue,
  blockReason,
  getBar,
  getCraftable,
  getOre,
  keptOrePerAction,
  level,
} from './actions';
import { addItem, averageQualityOf, removeRecipe } from './inventory';
import { rollBarQuality, rollCraftQuality, rollOreQuality } from './qualityRules';
import { rollRandomEvent, type RandomEvent } from './randomEvents';
import type { Rng } from './rng';
import { mineKey, type GameState, type QueueStep } from './state';

// The time loop. advance() moves the game forward by any amount of time,
// online or offline, one action at a time.

export type GameEvent =
  | { type: 'levelUp'; skill: SkillId; level: number }
  | { type: 'stepDone'; target: string; made: number }
  | { type: 'stepStopped'; target: string; reason: string }
  | { type: 'random'; event: RandomEvent }
  | { type: 'gem'; quality: number };

export interface AdvanceResult {
  events: GameEvent[];
  actions: number;
}

/** Safety cap on actions processed in one call (72 h offline is well under it). */
export const MAX_ACTIONS_PER_ADVANCE = 500_000;

export function advance(s: GameState, ms: number, rng: Rng): AdvanceResult {
  const result: AdvanceResult = { events: [], actions: 0 };
  let left = Math.max(0, ms);
  while (left > 0) {
    const step = s.queue[0];
    if (!step) {
      passTime(s, left, null);
      break;
    }
    const blocked = blockReason(s, step);
    if (blocked) {
      result.events.push({ type: 'stepStopped', target: step.target, reason: blocked });
      advanceQueue(s);
      continue;
    }
    if (result.actions >= MAX_ACTIONS_PER_ADVANCE) {
      passTime(s, left, null);
      break;
    }
    const need = actionTimeMs(s, step) - s.progressMs;
    if (left < need) {
      passTime(s, left, step);
      s.progressMs += left;
      break;
    }
    passTime(s, need, step);
    left -= need;
    s.progressMs = 0;
    result.actions++;
    completeAction(s, step, rng, result);
    if (step.amount != null && step.done >= step.amount) {
      result.events.push({ type: 'stepDone', target: step.target, made: step.done });
      advanceQueue(s);
    }
  }
  return result;
}

/** Time passing: buffs run down, momentum builds, mines deplete or recover. */
function passTime(s: GameState, ms: number, step: QueueStep | null): void {
  s.buffs.richVein = Math.max(0, s.buffs.richVein - ms);
  s.buffs.slowed = Math.max(0, s.buffs.slowed - ms);
  if (step) s.momentumMs += ms;
  const active = step?.kind === 'mine' ? mineKey(step.colony, step.target) : null;
  for (const key of Object.keys(s.depletion)) {
    if (key === active) continue;
    const v = s.depletion[key]! - ms * DEPLETION_RECOVERY_PER_MS;
    if (v <= 0) delete s.depletion[key];
    else s.depletion[key] = v;
  }
  if (active) s.depletion[active] = Math.min(DEPLETION_MAX, (s.depletion[active] ?? 0) + ms * DEPLETION_PER_MS);
}

function gainXp(s: GameState, skill: SkillId, xp: number, result: AdvanceResult): void {
  const before = level(s, skill);
  s.xp[skill] += xp;
  const after = level(s, skill);
  if (after > before) result.events.push({ type: 'levelUp', skill, level: after });
}

function completeAction(s: GameState, step: QueueStep, rng: Rng, result: AdvanceResult): void {
  if (step.kind === 'mine') mine(s, step, getOre(step.target)!, rng, result);
  else if (step.kind === 'refine') refine(s, step, rng, result);
  else craft(s, step, rng, result);

  const ev = rollRandomEvent(s, step, rng);
  if (ev) result.events.push({ type: 'random', event: ev });
}

function mine(s: GameState, step: QueueStep, ore: Ore, rng: Rng, result: AdvanceResult): void {
  const ml = level(s, 'mining');
  const kept = keptOrePerAction(s, step.colony, ore) * (s.buffs.richVein > 0 ? RICH_VEIN_YIELD : 1);
  const carry = (s.oreCarry[ore.id] ?? 0) + kept;
  const whole = Math.floor(carry);
  s.oreCarry[ore.id] = carry - whole;
  if (whole > 0) {
    // Don't overshoot the step's target amount.
    const give = step.amount != null ? Math.min(whole, step.amount - step.done) : whole;
    addItem(s.inventory, ore.id, rollOreQuality(ore, ml, rng), give);
    step.done += give;
    if (give < whole) s.oreCarry[ore.id]! += whole - give;
  }
  // XP is per action and ignores the fee (GDD).
  gainXp(s, 'mining', ore.xp, result);
  if (rng() < gemChance(ore)) {
    const q = rollOreQuality(ore, ml, rng);
    addItem(s.inventory, ROUGH_GEM.id, q, 1);
    result.events.push({ type: 'gem', quality: q });
  }
}

function refine(s: GameState, step: QueueStep, rng: Rng, result: AdvanceResult): void {
  const bar = getBar(step.target)!;
  const taken = removeRecipe(s.inventory, bar.recipe, 1, step.pick)!;
  const q = rollBarQuality(averageQualityOf(Object.values(taken)), level(s, 'refining'), bar.refiningLevel, rng);
  addItem(s.inventory, bar.id, q, 1);
  step.done++;
  gainXp(s, 'refining', bar.xp, result);
}

function craft(s: GameState, step: QueueStep, rng: Rng, result: AdvanceResult): void {
  const item = getCraftable(step.target)!;
  const taken = removeRecipe(s.inventory, item.recipe, 1, step.pick)!;
  const { quality } = rollCraftQuality(averageQualityOf(Object.values(taken)), level(s, 'crafting'), item.craftingLevel, rng);
  addItem(s.inventory, item.id, quality, 1);
  step.done++;
  gainXp(s, 'crafting', item.xp, result);
}
