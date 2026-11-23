import { describe, expect, it } from 'vitest';
import { runSim } from './run';

// Loose pacing guard rails for the twice-a-day bot (PLAN.md section 3 targets).
// They catch big accidental changes; S6 tightens them once the ship exists.
describe('pacing (twice-a-day bot, 21 days)', () => {
  const m = runSim(21);

  it('finishes the oil depot chain in the first week', () => {
    expect(m.oilSteps).toHaveLength(5);
    expect(m.oilSteps[4]!).toBeLessThanOrEqual(7);
  });

  it('reaches max home rank (prestige reward) within 1.5–3 weeks', () => {
    expect(m.homeRanks[10]).toBeDefined();
    expect(m.homeRanks[10]!).toBeGreaterThanOrEqual(10);
    expect(m.homeRanks[10]!).toBeLessThanOrEqual(21);
  });

  it('is deterministic', () => {
    expect(runSim(3).daily).toEqual(runSim(3).daily);
  });
});
