import { getItem } from '../data/items';
import type { ColonyId } from '../data/types';
import { getColony } from '../data/world';
import { clampQuality } from './quality';

// What an item is worth. Quality scales value from ×0.75 (quality 1) to ×1.25
// (quality 100) — a first-pass number for S6 to tune (PLAN.md section 3).

export const QUALITY_VALUE_MIN = 0.75;
export const QUALITY_VALUE_MAX = 1.25;

export function qualityValueMultiplier(quality: number): number {
  const q = clampQuality(quality);
  return QUALITY_VALUE_MIN + ((QUALITY_VALUE_MAX - QUALITY_VALUE_MIN) * (q - 1)) / 99;
}

/** Value of one unit at a quality, before local demand. Drives reputation, broker, donations. */
export const unitValue = (item: string, quality: number): number => getItem(item).value * qualityValueMultiplier(quality);

/** Local demand multiplier for an item in a colony (1 if the colony has no preference). */
export const demandFor = (colony: ColonyId, item: string): number => getColony(colony).demand[getItem(item).kind] ?? 1;

/** Market value of one unit in a colony: what a 100% stall price charges. */
export const marketValue = (colony: ColonyId, item: string, quality: number): number =>
  unitValue(item, quality) * demandFor(colony, item);
