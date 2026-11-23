// PLAN.md section 3: every mined, refined or crafted item has a quality from
// 1 to 100. Tier names are for display; the number is what counts. The
// formulas that produce quality (ceilings, skill rolls) land in S2/S6.

export const MIN_QUALITY = 1;
export const MAX_QUALITY = 100;

export interface QualityTier {
  readonly name: string;
  /** Lowest quality in this tier (inclusive). */
  readonly min: number;
}

export const QUALITY_TIERS: readonly QualityTier[] = [
  { name: 'Crude', min: 1 },
  { name: 'Rough', min: 20 },
  { name: 'Standard', min: 40 },
  { name: 'Fine', min: 60 },
  { name: 'Superior', min: 80 },
  { name: 'Masterwork', min: 95 },
  { name: 'Perfect craft', min: 100 },
];

/** Round and clamp any number into a valid quality (integer 1–100). */
export function clampQuality(q: number): number {
  if (!Number.isFinite(q)) return MIN_QUALITY;
  return Math.max(MIN_QUALITY, Math.min(MAX_QUALITY, Math.round(q)));
}

export function qualityTier(q: number): QualityTier {
  const v = clampQuality(q);
  let tier = QUALITY_TIERS[0]!;
  for (const t of QUALITY_TIERS) if (v >= t.min) tier = t;
  return tier;
}
