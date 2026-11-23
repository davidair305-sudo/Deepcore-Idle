import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, buildTable, levelForXp, levelProgress, xpForLevel } from './xp';

describe('xp curve', () => {
  it('matches the RuneScape table scaled ×12', () => {
    const rs = buildTable(1);
    expect(rs[2]).toBe(83);
    expect(rs[99]).toBe(13_034_431);
    expect(xpForLevel(2)).toBe(83 * 12);
    expect(xpForLevel(99)).toBe(13_034_431 * 12);
  });

  it('matches the values the pacing sim used', () => {
    expect(xpForLevel(10)).toBe(13_848);
    expect(xpForLevel(30)).toBe(160_356);
    expect(xpForLevel(75)).toBe(14_525_052);
  });

  it('converts xp to level at the thresholds', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(xpForLevel(2) - 1)).toBe(1);
    expect(levelForXp(xpForLevel(2))).toBe(2);
    expect(levelForXp(xpForLevel(50))).toBe(50);
    expect(levelForXp(1e12)).toBe(MAX_LEVEL);
  });

  it('is strictly increasing', () => {
    for (let l = 2; l <= MAX_LEVEL; l++) expect(xpForLevel(l)).toBeGreaterThan(xpForLevel(l - 1));
  });

  it('reports progress within a level', () => {
    const mid = (xpForLevel(10) + xpForLevel(11)) / 2;
    expect(levelProgress(mid)).toBeCloseTo(0.5, 5);
    expect(levelProgress(1e12)).toBe(1);
  });
});
