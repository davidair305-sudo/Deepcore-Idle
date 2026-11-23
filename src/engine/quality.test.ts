import { describe, expect, it } from 'vitest';
import { clampQuality, qualityTier } from './quality';

describe('quality', () => {
  it('clamps to integers 1–100', () => {
    expect(clampQuality(0)).toBe(1);
    expect(clampQuality(-5)).toBe(1);
    expect(clampQuality(150)).toBe(100);
    expect(clampQuality(49.6)).toBe(50);
    expect(clampQuality(Number.NaN)).toBe(1);
  });

  it('names tiers at the boundaries', () => {
    expect(qualityTier(1).name).toBe('Crude');
    expect(qualityTier(19).name).toBe('Crude');
    expect(qualityTier(20).name).toBe('Rough');
    expect(qualityTier(59).name).toBe('Standard');
    expect(qualityTier(60).name).toBe('Fine');
    expect(qualityTier(94).name).toBe('Superior');
    expect(qualityTier(95).name).toBe('Masterwork');
    expect(qualityTier(99).name).toBe('Masterwork');
    expect(qualityTier(100).name).toBe('Perfect craft');
  });
});
