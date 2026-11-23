import { describe, expect, it } from 'vitest';
import { addItem, countItem } from './inventory';
import {
  enqueue,
  equippedKit,
  keptOrePerAction,
  momentum,
  npcRefineAll,
  startAction,
  stopAll,
} from './actions';
import { getItem } from '../data/items';
import type { Ore } from '../data/types';
import { effectiveOfflineMs, applyOffline } from './offline';
import { seededRng } from './rng';
import { newGame, type GameState } from './state';
import { advance } from './tick';
import { xpForLevel } from './xp';

const MIN = 60_000;
const HOUR = 60 * MIN;
// An rng that never triggers random events or gems, for exact arithmetic.
const quietRng = () => 0.999;

function withLevels(levels: Partial<Record<'mining' | 'refining' | 'crafting', number>>): GameState {
  const s = newGame();
  for (const [k, l] of Object.entries(levels)) s.xp[k as 'mining'] = xpForLevel(l!);
  return s;
}

describe('mining', () => {
  it('earns XP per action and keeps ore after the fee', () => {
    const s = newGame();
    startAction(s, { kind: 'mine', target: 'copper' });
    const r = advance(s, 30_000, quietRng);
    expect(r.actions).toBe(10);
    expect(s.xp.mining).toBe(50);
    // yield 1.0 × 40% kept (60% fee) ≈ 0.4 per action → 4 copper (minus tiny depletion).
    expect(countItem(s.inventory, 'copper')).toBe(3);
  });

  it('mines about 1,200 actions an hour', () => {
    const s = newGame();
    startAction(s, { kind: 'mine', target: 'copper' });
    const r = advance(s, HOUR, seededRng(9));
    expect(r.actions).toBeGreaterThan(1150);
    expect(r.actions).toBeLessThanOrEqual(1200);
    expect(countItem(s.inventory, 'copper')).toBeGreaterThan(400);
  });

  it('stops exactly at the target amount', () => {
    const s = newGame();
    startAction(s, { kind: 'mine', target: 'copper', amount: 10 });
    const r = advance(s, HOUR, quietRng);
    expect(countItem(s.inventory, 'copper')).toBe(10);
    expect(s.queue).toEqual([]);
    expect(r.events).toContainEqual({ type: 'stepDone', target: 'copper', made: 10 });
  });

  it('blocks ores above your level or outside the colony', () => {
    const s = newGame();
    startAction(s, { kind: 'mine', target: 'iron' });
    const r = advance(s, 10_000, quietRng);
    expect(r.events[0]).toMatchObject({ type: 'stepStopped', reason: 'Needs Mining 12' });
    startAction(s, { kind: 'mine', target: 'titanium' });
    expect(advance(s, 10_000, quietRng).events[0]).toMatchObject({ reason: "Titanium isn't mined at Authority" });
  });

  it('yields more with lower fees, kits and levels', () => {
    const s = withLevels({ mining: 30 });
    const cu = getItem('copper') as Ore;
    const base = keptOrePerAction(s, 'authority', cu);
    s.rep.authority = 2_500_000;
    expect(keptOrePerAction(s, 'authority', cu) / base).toBeCloseTo(0.9 / 0.4);
    s.kits.push('steelKit', 'gravsteelKit');
    expect(equippedKit(s).id).toBe('steelKit'); // gravsteel needs Mining 85
  });

  it('levels up and reports it', () => {
    const s = newGame();
    startAction(s, { kind: 'mine', target: 'copper' });
    const r = advance(s, HOUR, quietRng);
    expect(r.events.some((e) => e.type === 'levelUp' && e.skill === 'mining')).toBe(true);
  });
});

describe('momentum and depletion', () => {
  it('builds momentum from level 10, max +25%, and resets on a switch', () => {
    const low = newGame();
    startAction(low, { kind: 'mine', target: 'copper' });
    advance(low, HOUR, quietRng);
    expect(momentum(low)).toBe(1); // still under level 10 at the start of the hour

    const s = withLevels({ mining: 10 });
    startAction(s, { kind: 'mine', target: 'copper' });
    advance(s, 31 * MIN, quietRng);
    expect(momentum(s)).toBeCloseTo(1.05);
    advance(s, 3 * HOUR, quietRng);
    expect(momentum(s)).toBeCloseTo(1.25);
    startAction(s, { kind: 'mine', target: 'tin' });
    expect(momentum(s)).toBe(1);
  });

  it('depletes 2% per 30 min up to 15%, and recovers when mining elsewhere', () => {
    const s = withLevels({ mining: 10 });
    startAction(s, { kind: 'mine', target: 'copper' });
    advance(s, 30 * MIN, quietRng);
    expect(s.depletion['authority:copper']).toBeCloseTo(0.02, 3);
    advance(s, 10 * HOUR, quietRng);
    expect(s.depletion['authority:copper']).toBeCloseTo(0.15);
    startAction(s, { kind: 'mine', target: 'tin' });
    advance(s, 2 * HOUR, quietRng);
    expect(s.depletion['authority:copper']).toBeUndefined();
  });
});

describe('refining, crafting and the queue', () => {
  it('refines until inputs run out, then stops with a reason', () => {
    const s = newGame();
    addItem(s.inventory, 'copper', 20, 3);
    addItem(s.inventory, 'tin', 20, 5);
    startAction(s, { kind: 'refine', target: 'bronze' });
    const r = advance(s, HOUR, quietRng);
    expect(countItem(s.inventory, 'bronze')).toBe(3);
    expect(countItem(s.inventory, 'tin')).toBe(2);
    expect(s.xp.refining).toBe(30);
    expect(r.events).toContainEqual({ type: 'stepStopped', target: 'bronze', reason: 'Out of materials for Bronze bar' });
    expect(s.queue).toEqual([]);
  });

  it('only refines bars the colony refines', () => {
    const s = withLevels({ refining: 60 });
    addItem(s.inventory, 'titanium', 50, 2);
    addItem(s.inventory, 'ferrocite', 50, 1);
    startAction(s, { kind: 'refine', target: 'ferroTitanium' });
    expect(advance(s, 10_000, quietRng).events[0]).toMatchObject({ reason: "Ferro-Titanium bar isn't refined at Authority" });
  });

  it('respects queue slots', () => {
    const s = newGame();
    expect(enqueue(s, { kind: 'mine', target: 'copper' })).toBe(true);
    expect(enqueue(s, { kind: 'refine', target: 'bronze' })).toBe(false);
    s.queueSlots = 3;
    expect(enqueue(s, { kind: 'refine', target: 'bronze' })).toBe(true);
    stopAll(s);
    expect(s.queue).toEqual([]);
  });

  it('runs a queue: refine then craft, carrying quality through', () => {
    const s = newGame();
    s.queueSlots = 2;
    addItem(s.inventory, 'copper', 20, 6);
    addItem(s.inventory, 'tin', 20, 6);
    enqueue(s, { kind: 'refine', target: 'bronze', amount: 6 });
    enqueue(s, { kind: 'craft', target: 'bronzeFittings' });
    const r = advance(s, HOUR, seededRng(5));
    expect(countItem(s.inventory, 'bronzeFittings')).toBe(3);
    expect(s.xp.crafting).toBe(45);
    expect(r.events.map((e) => e.type)).toEqual(expect.arrayContaining(['stepDone', 'stepStopped']));
    for (const q of Object.keys(s.inventory.bronzeFittings!).map(Number)) expect(q).toBeLessThanOrEqual(25);
  });

  it('NPC refiner keeps 40%, gives no XP and pours at 70% quality', () => {
    const s = newGame();
    addItem(s.inventory, 'copper', 20, 10);
    addItem(s.inventory, 'tin', 20, 10);
    expect(npcRefineAll(s, 'bronze')).toBe(6);
    expect(s.inventory.bronze).toEqual({ 14: 6 });
    expect(s.xp.refining).toBe(0);
    expect(countItem(s.inventory, 'copper')).toBe(0);
  });
});

describe('determinism and offline', () => {
  it('gives the same result for the same seed', () => {
    const run = () => {
      const s = newGame();
      startAction(s, { kind: 'mine', target: 'copper' });
      advance(s, 5 * HOUR, seededRng(42));
      return s;
    };
    expect(run()).toEqual(run());
  });

  it('caps offline time: 24 h full, next 48 h at half, nothing after 72 h', () => {
    expect(effectiveOfflineMs(10 * HOUR)).toBe(10 * HOUR);
    expect(effectiveOfflineMs(30 * HOUR)).toBe(27 * HOUR);
    expect(effectiveOfflineMs(72 * HOUR)).toBe(48 * HOUR);
    expect(effectiveOfflineMs(500 * HOUR)).toBe(48 * HOUR);
    expect(effectiveOfflineMs(-5)).toBe(0);
  });

  it('runs a full 72 h offline stretch quickly', () => {
    const s = newGame();
    startAction(s, { kind: 'mine', target: 'copper' });
    const t0 = performance.now();
    const r = applyOffline(s, 72 * HOUR, seededRng(7));
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(r.effectiveMs).toBe(48 * HOUR);
    expect(r.actions).toBeGreaterThan(50_000);
  });
});
