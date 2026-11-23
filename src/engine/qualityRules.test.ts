import { describe, expect, it } from 'vitest';
import { getItem } from '../data/items';
import type { Ore } from '../data/types';
import { MINING_MASTERY_LEVELS, craftOutcomeChances, oreQualityCap, skillMargin, rollBarQuality, rollCraftQuality, rollOreQuality } from './qualityRules';
import { seededRng } from './rng';

const ore = (id: string) => getItem(id) as Ore;
const mean = (f: () => number, n = 4000) => {
  let t = 0;
  for (let i = 0; i < n; i++) t += f();
  return t / n;
};

describe('quality rules', () => {
  it('lets level 99 master even the top-tier items', () => {
    expect(skillMargin(99, 75, MINING_MASTERY_LEVELS)).toBe(1);
    expect(skillMargin(41, 1, MINING_MASTERY_LEVELS)).toBe(1);
    expect(skillMargin(21, 1, MINING_MASTERY_LEVELS)).toBeCloseTo(0.5);
  });

  it('caps ore quality by ore level: copper low, palladium perfect', () => {
    expect(oreQualityCap(ore('copper'))).toBe(20);
    expect(oreQualityCap(ore('palladium'))).toBe(100);
    expect(oreQualityCap(ore('titanium'))).toBeGreaterThan(oreQualityCap(ore('iron')));
  });

  it('rolls ore quality toward the cap as Mining rises', () => {
    const rng = seededRng(1);
    const pd = ore('palladium');
    const atReq = mean(() => rollOreQuality(pd, 75, rng));
    const atMastery = mean(() => rollOreQuality(pd, 99, rng));
    expect(atReq).toBeGreaterThan(40);
    expect(atReq).toBeLessThan(60);
    expect(atMastery).toBeGreaterThan(80);
    for (let i = 0; i < 500; i++) expect(rollOreQuality(ore('copper'), 99, rng)).toBeLessThanOrEqual(20);
  });

  it('keeps more bar quality with Refining skill', () => {
    const rng = seededRng(2);
    const low = mean(() => rollBarQuality(80, 1, 1, rng));
    const high = mean(() => rollBarQuality(80, 41, 1, rng));
    expect(low).toBeGreaterThan(55);
    expect(low).toBeLessThan(62);
    expect(high).toBeGreaterThan(80);
  });

  it('has craft outcome chances that sum to 1 at any skill', () => {
    for (const s of [0, 0.3, 1]) expect(craftOutcomeChances(s).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('only gives a perfect craft with top inputs and high skill', () => {
    const rng = seededRng(3);
    let perfectLow = 0;
    let perfectHigh = 0;
    let perfectWeakInputs = 0;
    for (let i = 0; i < 5000; i++) {
      if (rollCraftQuality(98, 1, 1, rng).quality === 100) perfectLow++;
      if (rollCraftQuality(98, 99, 1, rng).quality === 100) perfectHigh++;
      if (rollCraftQuality(60, 99, 1, rng).quality === 100) perfectWeakInputs++;
    }
    expect(perfectLow).toBe(0);
    expect(perfectHigh).toBeGreaterThan(500);
    expect(perfectWeakInputs).toBe(0);
  });

  it('botches often at low skill', () => {
    const rng = seededRng(4);
    const botched = Array.from({ length: 2000 }, () => rollCraftQuality(50, 1, 1, rng).outcome).filter((o) => o === 'botched').length;
    expect(botched / 2000).toBeGreaterThan(0.25);
  });
});
