// GDD "Shared rules": RuneScape-style XP curve scaled ×12, level cap 99.
// The multiplier is the main pacing dial for the 2–3 week launch target
// (PLAN.md A8); S6 tunes it with the balance sim.

export const XP_MULTIPLIER = 12;
export const MAX_LEVEL = 99;

/** XP_TABLE[level] = total XP needed to reach that level (index 0 unused). */
export const XP_TABLE: readonly number[] = buildTable(XP_MULTIPLIER);

export function buildTable(multiplier: number): number[] {
  const table = [0, 0];
  let points = 0;
  for (let level = 1; level < MAX_LEVEL; level++) {
    points += Math.floor(level + 300 * 2 ** (level / 7));
    table.push(Math.floor(points / 4) * multiplier);
  }
  return table;
}

export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return XP_TABLE[l]!;
}

export function levelForXp(xp: number): number {
  // Binary search: highest level whose threshold is <= xp.
  let lo = 1;
  let hi = MAX_LEVEL;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (XP_TABLE[mid]! <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Progress inside the current level, 0–1 (1 at the cap). */
export function levelProgress(xp: number): number {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return 1;
  const lo = XP_TABLE[level]!;
  const hi = XP_TABLE[level + 1]!;
  return (xp - lo) / (hi - lo);
}
