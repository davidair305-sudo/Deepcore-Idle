import { clampQuality } from './quality';

// Inventory stacks by item + quality (PLAN.md section 3). Storage is
// unlimited (GDD). The shape is plain JSON so it saves as-is:
//   { [itemId]: { [quality]: count } }
// Functions mutate the inventory passed in; the engine owns one per save.

export type Inventory = Record<string, Record<number, number>>;

/** Which units a recipe or sale uses first. */
export type PickOrder = 'lowest' | 'highest';

/** What was taken from a stack: quality -> count. */
export type Taken = Record<number, number>;

export const emptyInventory = (): Inventory => ({});

export function addItem(inv: Inventory, item: string, quality: number, count: number): void {
  if (!Number.isInteger(count) || count < 0) throw new Error(`Bad count: ${count}`);
  if (count === 0) return;
  const q = clampQuality(quality);
  const stacks = (inv[item] ??= {});
  stacks[q] = (stacks[q] ?? 0) + count;
}

export function countItem(inv: Inventory, item: string): number {
  const stacks = inv[item];
  if (!stacks) return 0;
  let n = 0;
  for (const c of Object.values(stacks)) n += c;
  return n;
}

/** Qualities held for an item, sorted in the given order. */
export function qualitiesOf(inv: Inventory, item: string, order: PickOrder = 'lowest'): number[] {
  const qs = Object.keys(inv[item] ?? {}).map(Number);
  return qs.sort((a, b) => (order === 'lowest' ? a - b : b - a));
}

/**
 * Remove `count` units, picking by quality order. Returns what was taken, or
 * null (and changes nothing) if there aren't enough.
 */
export function removeItem(inv: Inventory, item: string, count: number, order: PickOrder = 'lowest'): Taken | null {
  if (!Number.isInteger(count) || count < 0) throw new Error(`Bad count: ${count}`);
  if (countItem(inv, item) < count) return null;
  const taken: Taken = {};
  if (count === 0) return taken;
  const stacks = inv[item]!;
  let left = count;
  for (const q of qualitiesOf(inv, item, order)) {
    const use = Math.min(left, stacks[q]!);
    taken[q] = use;
    stacks[q]! -= use;
    if (stacks[q] === 0) delete stacks[q];
    left -= use;
    if (left === 0) break;
  }
  if (Object.keys(stacks).length === 0) delete inv[item];
  return taken;
}

/**
 * Remove a whole recipe at once. All-or-nothing: if any ingredient is short,
 * nothing changes and null is returned. Otherwise returns what was taken per item.
 */
export function removeRecipe(
  inv: Inventory,
  recipe: Readonly<Record<string, number>>,
  times = 1,
  order: PickOrder = 'lowest',
): Record<string, Taken> | null {
  for (const [item, n] of Object.entries(recipe)) if (countItem(inv, item) < n * times) return null;
  const out: Record<string, Taken> = {};
  for (const [item, n] of Object.entries(recipe)) out[item] = removeItem(inv, item, n * times, order)!;
  return out;
}

/** Count-weighted average quality of a Taken set (0 if empty). */
export function averageQuality(taken: Taken): number {
  let n = 0;
  let sum = 0;
  for (const [q, c] of Object.entries(taken)) {
    n += c;
    sum += Number(q) * c;
  }
  return n === 0 ? 0 : sum / n;
}

/** Average quality across several Takens, weighted by unit count. */
export function averageQualityOf(takens: readonly Taken[]): number {
  const merged: Taken = {};
  for (const t of takens) for (const [q, c] of Object.entries(t)) merged[Number(q)] = (merged[Number(q)] ?? 0) + c;
  return averageQuality(merged);
}
