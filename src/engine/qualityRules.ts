import type { Ore } from '../data/types';
import { clampQuality } from './quality';
import { pickWeighted, type Rng } from './rng';
import { MAX_LEVEL } from './xp';

// How quality is produced (PLAN.md section 3). Every number here is a
// first-pass proposal; S6 tunes them with the balance sim.

/** Levels above an item's requirement at which skill stops improving quality. */
export const MINING_MASTERY_LEVELS = 40;
export const REFINING_MASTERY_LEVELS = 40;
export const CRAFTING_MASTERY_LEVELS = 50;

/**
 * 0 at the level requirement, 1 at mastery. Mastery is `masteryLevels` above
 * the requirement, but never past level 99, so top-tier items can still be
 * mastered (palladium at Mining 75 masters at 99, not 115).
 */
export function skillMargin(level: number, required: number, masteryLevels: number): number {
  const span = Math.max(1, Math.min(masteryLevels, MAX_LEVEL - required));
  return Math.max(0, Math.min(1, (level - required) / span));
}

/**
 * Highest quality an ore can ever have. Grows with the ore's level from 20
 * (copper) to 100 at palladium (level 75), so only top ores can feed a perfect craft.
 */
export function oreQualityCap(ore: Ore): number {
  return clampQuality(20 + 80 * Math.min(1, (ore.miningLevel - 1) / 74));
}

/**
 * Quality of ore from one mining action. At the requirement the average is
 * half the cap; at mastery it's near the cap. Rolls spread ±15% of the cap.
 */
export function rollOreQuality(ore: Ore, miningLevel: number, rng: Rng): number {
  const cap = oreQualityCap(ore);
  const s = skillMargin(miningLevel, ore.miningLevel, MINING_MASTERY_LEVELS);
  const mean = cap * (0.5 + 0.45 * s);
  const q = mean + (rng() * 2 - 1) * 0.15 * cap;
  return clampQuality(Math.min(cap, q));
}

/** Chance of a better pour (+5 quality) when refining. */
export const betterPourChance = (s: number): number => 0.05 + 0.15 * s;

/**
 * Bar quality: refining keeps 70% of the input quality at the requirement and
 * 100% at mastery, with a chance of a better pour.
 */
export function rollBarQuality(inputQuality: number, refiningLevel: number, required: number, rng: Rng): number {
  const s = skillMargin(refiningLevel, required, REFINING_MASTERY_LEVELS);
  let q = inputQuality * (0.7 + 0.3 * s);
  if (rng() < betterPourChance(s)) q += 5;
  return clampQuality(q);
}

export type CraftOutcome = 'botched' | 'standard' | 'fine' | 'masterwork';

interface OutcomeRule {
  readonly id: CraftOutcome;
  readonly multiplier: number;
  readonly bonus: number;
  /** Chance at the level requirement and at mastery; linear in between. */
  readonly chanceLow: number;
  readonly chanceHigh: number;
}

export const CRAFT_OUTCOMES: readonly OutcomeRule[] = [
  { id: 'botched', multiplier: 0.6, bonus: 0, chanceLow: 0.3, chanceHigh: 0 },
  { id: 'standard', multiplier: 0.85, bonus: 0, chanceLow: 0.6, chanceHigh: 0.15 },
  { id: 'fine', multiplier: 1, bonus: 0, chanceLow: 0.1, chanceHigh: 0.65 },
  { id: 'masterwork', multiplier: 1, bonus: 5, chanceLow: 0, chanceHigh: 0.2 },
];

export function craftOutcomeChances(s: number): number[] {
  return CRAFT_OUTCOMES.map((o) => o.chanceLow + (o.chanceHigh - o.chanceLow) * s);
}

/**
 * Crafted item quality: input quality × the rolled outcome. A perfect craft
 * (100) needs inputs of 95+ and a masterwork roll, which only high skill gives.
 */
export function rollCraftQuality(
  inputQuality: number,
  craftingLevel: number,
  required: number,
  rng: Rng,
): { quality: number; outcome: CraftOutcome } {
  const s = skillMargin(craftingLevel, required, CRAFTING_MASTERY_LEVELS);
  const rule = CRAFT_OUTCOMES[pickWeighted(rng, craftOutcomeChances(s))]!;
  return { quality: clampQuality(inputQuality * rule.multiplier + rule.bonus), outcome: rule.id };
}

/** NPC refiners work fast and sloppy: 70% of input quality, no better pours. */
export const npcBarQuality = (inputQuality: number): number => clampQuality(inputQuality * 0.7);
