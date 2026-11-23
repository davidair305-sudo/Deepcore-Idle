import { describe, expect, it } from 'vitest';
import { ALL_ITEMS, BARS, CRAFTABLES, ORES, getItem, isItemId } from './items';
import { COLONIES, KITS, OIL_CHAIN } from './world';

describe('data tables', () => {
  it('has unique item ids', () => {
    const ids = ALL_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only references known items in recipes', () => {
    for (const r of [...BARS, ...CRAFTABLES]) for (const id of Object.keys(r.recipe)) expect(isItemId(id), `${r.id} → ${id}`).toBe(true);
    for (const s of OIL_CHAIN) for (const id of Object.keys(s.deliver ?? {})) expect(isItemId(id), id).toBe(true);
  });

  it('only references known ores and bars in colonies', () => {
    for (const c of COLONIES) {
      for (const id of c.ores) expect(getItem(id).kind).toBe('ore');
      for (const id of c.bars) expect(getItem(id).kind).toBe('bar');
    }
  });

  it('puts every ore in at least one colony (free switching makes all reachable)', () => {
    const mined = new Set(COLONIES.flatMap((c) => c.ores));
    for (const o of ORES) expect(mined.has(o.id), o.id).toBe(true);
  });

  it('can refine every bar in at least one colony', () => {
    const refined = new Set(COLONIES.flatMap((c) => c.bars));
    for (const b of BARS) expect(refined.has(b.id), b.id).toBe(true);
  });

  it('matches GDD spot values', () => {
    expect(getItem('titanium')).toMatchObject({ miningLevel: 50, yield: 0.4, xp: 30, value: 20 });
    expect(getItem('cobaltSteel')).toMatchObject({ refiningLevel: 30, xp: 45, value: 104 });
    expect(getItem('navCircuit')).toMatchObject({ craftingLevel: 75, xp: 120, value: 120 });
    expect(COLONIES.map((c) => c.startingFee)).toEqual([0.6, 0.75, 0.85]);
  });

  it('references real kits in oil chain rewards', () => {
    for (const s of OIL_CHAIN) if (s.reward.kit) expect(KITS.some((k) => k.id === s.reward.kit)).toBe(true);
  });

  it('opens the hangar after oil chain step 2 (PLAN.md 3a)', () => {
    expect(OIL_CHAIN.findIndex((s) => s.reward.hangar)).toBe(1);
  });
});
