import { describe, expect, it } from 'vitest';
import { colonyFee, feeAtRank, rankForRep, rankProgress, repForRank } from './reputation';

describe('reputation', () => {
  it('needs 25,000 × n² rep for rank n', () => {
    expect(repForRank(1)).toBe(25_000);
    expect(repForRank(10)).toBe(2_500_000);
    expect(rankForRep(0)).toBe(0);
    expect(rankForRep(24_999)).toBe(0);
    expect(rankForRep(25_000)).toBe(1);
    expect(rankForRep(99_999)).toBe(1);
    expect(rankForRep(100_000)).toBe(2);
    expect(rankForRep(1e9)).toBe(10);
  });

  it('lowers the fee in even steps to 10% at rank 10', () => {
    expect(feeAtRank(0.6, 0)).toBeCloseTo(0.6);
    expect(feeAtRank(0.6, 1)).toBeCloseTo(0.55);
    expect(feeAtRank(0.6, 10)).toBeCloseTo(0.1);
    expect(feeAtRank(0.85, 5)).toBeCloseTo(0.475);
    expect(colonyFee('union', 0)).toBeCloseTo(0.75);
    expect(colonyFee('corporate', 2_500_000)).toBeCloseTo(0.1);
  });

  it('reports progress to the next rank', () => {
    expect(rankProgress(0)).toBe(0);
    expect(rankProgress((25_000 + 100_000) / 2)).toBeCloseTo(0.5);
    expect(rankProgress(3e6)).toBe(1);
  });
});
