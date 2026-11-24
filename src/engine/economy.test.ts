import { describe, expect, it } from 'vitest';
import { OIL_CHAIN } from '../data/world';
import { enqueue, startAction } from './actions';
import { boardFor, deliverContract, msToNextBoard, oilBlockReason, turnInOilStep, CONTRACT_WINDOW_MS } from './contracts';
import { addItem, countItem } from './inventory';
import { buyKit, donate, sellToBroker } from './market';
import { repForRank } from './reputation';
import { MAX_WARES, clampPrice, listWare, moveWare, normalSpeedPrice, saleSpeed, saleTimeMs, setWarePrice, unlistWare } from './stall';
import { newGame } from './state';
import { advance } from './tick';
import { marketValue, qualityValueMultiplier, unitValue } from './value';
import { xpForLevel } from './xp';

const HOUR = 3_600_000;
const quietRng = () => 0.999;

describe('value', () => {
  it('scales value with quality from ×0.75 to ×1.25', () => {
    expect(qualityValueMultiplier(1)).toBeCloseTo(0.75);
    expect(qualityValueMultiplier(100)).toBeCloseTo(1.25);
    expect(qualityValueMultiplier(50.5)).toBeCloseTo(1, 1);
    expect(unitValue('bronze', 100)).toBeCloseTo(12.5);
  });

  it('applies local demand', () => {
    expect(marketValue('union', 'bronze', 100)).toBeCloseTo(12.5 * 1.1);
    expect(marketValue('authority', 'bronze', 100)).toBeCloseTo(12.5 * 0.9);
    expect(marketValue('corporate', 'polishedGem', 100)).toBeCloseTo(90 * 1.25 * 1.3);
  });
});

describe('stall pricing (D14)', () => {
  it('sells at normal speed at market price for a new trader', () => {
    expect(normalSpeedPrice(1)).toBe(1);
    expect(saleSpeed(1, 1)).toBeCloseTo(1);
  });

  it('sells faster below market and slower above it', () => {
    expect(saleSpeed(0.5, 1)).toBeCloseTo(Math.exp(0.5));
    expect(saleSpeed(2, 1)).toBeCloseTo(Math.exp(-1));
    expect(saleSpeed(0.8, 1)).toBeGreaterThan(1);
    expect(saleSpeed(1.2, 1)).toBeLessThan(1);
  });

  it('peaks credits per hour at the normal-speed price', () => {
    for (const tl of [1, 50, 99]) {
      const perHour = (p: number) => p * saleSpeed(p, tl);
      const best = normalSpeedPrice(tl);
      for (const p of [0.5, 0.8, best - 0.05, best + 0.05, 1.5, 2]) expect(perHour(best)).toBeGreaterThanOrEqual(perHour(p));
    }
  });

  it('lets veteran traders charge above market at normal speed', () => {
    expect(normalSpeedPrice(99)).toBeCloseTo(1.245);
    expect(saleSpeed(1.245, 99)).toBeCloseTo(1);
  });

  it('clamps the slider to 25%–300%', () => {
    expect(clampPrice(0.1)).toBe(0.25);
    expect(clampPrice(5)).toBe(3);
    expect(clampPrice(Number.NaN)).toBe(1);
  });

  it('manages wares in order', () => {
    const s = newGame();
    listWare(s, 'copper');
    listWare(s, 'tin', 1.5);
    listWare(s, 'copper', 0.5); // already listed: ignored
    expect(s.stall.map((w) => [w.item, w.price])).toEqual([['copper', 1], ['tin', 1.5]]);
    moveWare(s, 'tin', -1);
    expect(s.stall[0]!.item).toBe('tin');
    setWarePrice(s, 'tin', 9);
    expect(s.stall[0]!.price).toBe(3);
    unlistWare(s, 'tin');
    expect(s.stall.map((w) => w.item)).toEqual(['copper']);
  });

  it('has six display slots', () => {
    const s = newGame();
    for (const id of ['copper', 'tin', 'iron', 'nickel', 'cobalt', 'bronze']) expect(listWare(s, id)).toBe(true);
    expect(listWare(s, 'steel')).toBe(false);
    expect(s.stall).toHaveLength(MAX_WARES);
  });
});

describe('running the stall', () => {
  it('sells wares in list order, one unit per sale, and stops when sold out', () => {
    const s = newGame();
    addItem(s.inventory, 'bronze', 100, 3);
    addItem(s.inventory, 'copper', 1, 2);
    listWare(s, 'bronze');
    listWare(s, 'copper');
    startAction(s, { kind: 'sell', target: '' });
    expect(saleTimeMs(s)).toBeCloseTo(3000);
    const r = advance(s, 9_000, quietRng);
    expect(r.actions).toBe(3);
    expect(countItem(s.inventory, 'bronze')).toBe(0);
    expect(countItem(s.inventory, 'copper')).toBe(2);
    // 3 bronze at quality 100 at the Authority (bars ×0.9): 3 × 12.5 × 0.9
    expect(s.credits).toBeCloseTo(33.75);
    // Reputation is 20% of value, not of price.
    expect(s.rep.authority).toBeCloseTo(3 * 12.5 * 0.2);
    expect(s.xp.trading).toBeGreaterThan(0);
    const r2 = advance(s, HOUR, quietRng);
    expect(r2.events).toContainEqual({ type: 'stepStopped', target: 'stall', reason: 'Your stall is sold out' });
  });

  it('takes longer at a higher price', () => {
    const s = newGame();
    addItem(s.inventory, 'copper', 10, 100);
    listWare(s, 'copper', 2);
    startAction(s, { kind: 'sell', target: '' });
    expect(saleTimeMs(s)).toBeCloseTo(3000 / Math.exp(-1));
  });

  it('can be queued after a timed mining step', () => {
    const s = newGame();
    s.queueSlots = 2;
    listWare(s, 'copper');
    enqueue(s, { kind: 'mine', target: 'copper', durationMs: HOUR });
    expect(enqueue(s, { kind: 'sell', target: '' })).toBeNull();
    advance(s, 2 * HOUR, quietRng);
    expect(countItem(s.inventory, 'copper')).toBe(0);
    expect(s.credits).toBeGreaterThan(0);
  });
});

describe('broker, donations and the kit trader', () => {
  it('broker pays 60% and gives Authority rep, at home only', () => {
    const s = newGame();
    addItem(s.inventory, 'bronze', 100, 10);
    expect(sellToBroker(s, 'bronze', 4)).toMatchObject({ credits: 4 * 12.5 * 0.6, rep: 4 * 12.5 * 0.2 });
    s.colony = 'union';
    expect(sellToBroker(s, 'bronze', 1)).toBeNull();
  });

  it('donating gives 80% rep to the colony you are in', () => {
    const s = newGame();
    s.colony = 'corporate';
    addItem(s.inventory, 'bronze', 100, 10);
    expect(donate(s, 'bronze', 10)).toMatchObject({ credits: 25, rep: 100 });
    expect(s.rep.corporate).toBe(100);
    expect(donate(s, 'bronze', 1)).toBeNull();
  });

  it('kit trader needs rank 4 in that colony and enough credits', () => {
    const s = newGame();
    s.credits = 100_000;
    expect(buyKit(s, 'bronzeKit')).toMatchObject({ ok: false });
    s.rep.authority = repForRank(4);
    expect(buyKit(s, 'bronzeKit')).toEqual({ ok: true });
    expect(s.credits).toBe(97_500);
    expect(buyKit(s, 'bronzeKit')).toMatchObject({ ok: false, reason: 'You already own it' });
    expect(buyKit(s, 'starterKit')).toMatchObject({ ok: false });
  });
});

describe('oil depot chain', () => {
  it('runs all five steps with their rewards', () => {
    const s = newGame();
    expect(oilBlockReason(s)).toBe('Need 600 more Copper');
    addItem(s.inventory, 'copper', 10, 600);
    addItem(s.inventory, 'tin', 10, 600);
    expect(turnInOilStep(s)).toEqual({ ok: true });
    expect(s.kits).toContain('bronzeKit');
    expect(s.rep.authority).toBe(10_000);
    expect(s.xp.mining).toBe(2_000);

    addItem(s.inventory, 'bronze', 10, 300);
    expect(turnInOilStep(s)).toEqual({ ok: true });
    expect(s.oil.hangar).toBe(true);

    addItem(s.inventory, 'bronzeFittings', 10, 100);
    addItem(s.inventory, 'steelPlating', 10, 40);
    expect(turnInOilStep(s)).toEqual({ ok: true });
    expect(s.kits).toContain('steelKit');

    // Step 4: only stall sales made during this step count.
    expect(oilBlockReason(s)).toMatch(/^Sell 25,000 more credits/);
    addItem(s.inventory, 'gravsteelGemCirclet', 100, 40);
    listWare(s, 'gravsteelGemCirclet');
    startAction(s, { kind: 'sell', target: '' });
    advance(s, HOUR, quietRng);
    expect(s.oil.sales).toBeGreaterThanOrEqual(25_000);
    expect(turnInOilStep(s)).toEqual({ ok: true });
    expect(s.oil.token).toBe(true);

    expect(turnInOilStep(s)).toEqual({ ok: true });
    expect(s.oil).toMatchObject({ token: false, oilDepot: true, step: OIL_CHAIN.length });
    expect(s.rep.authority).toBeGreaterThanOrEqual(90_000); // 10k + 15k + 25k + 40k, plus stall rep
    expect(oilBlockReason(s)).toBe('The oil depot chain is finished');
  });

  it('only accepts turn-ins at the Authority', () => {
    const s = newGame();
    s.colony = 'union';
    expect(oilBlockReason(s)).toBe('Turn in at the Deepcore Colony Authority');
  });

  it('ignores sales made before step 4', () => {
    const s = newGame();
    addItem(s.inventory, 'copper', 10, 50);
    listWare(s, 'copper');
    startAction(s, { kind: 'sell', target: '' });
    advance(s, HOUR, quietRng);
    expect(s.oil.sales).toBe(0);
  });
});

describe('repeatable contracts', () => {
  const now = 10 * CONTRACT_WINDOW_MS + 1000;

  it('posts 3 contracts from things you can make, and keeps them for the window', () => {
    const s = newGame();
    s.xp.mining = xpForLevel(30);
    s.xp.refining = xpForLevel(30);
    const board = boardFor(s, 'authority', now);
    expect(board.offers).toHaveLength(3);
    for (const o of board.offers) expect(['copper', 'tin', 'iron', 'nickel', 'cobalt', 'bronze', 'steel', 'cobaltSteel']).toContain(o.item);
    s.xp.mining = xpForLevel(99);
    expect(boardFor(s, 'authority', now + 1000)).toBe(board); // levelling up mid-window doesn't reshuffle
    expect(boardFor(s, 'authority', now + CONTRACT_WINDOW_MS)).not.toBe(board);
  });

  it('only offers what a new player can make', () => {
    const s = newGame();
    expect(boardFor(s, 'authority', now).offers.map((o) => o.item).sort()).toEqual(['bronze', 'copper']); // tin needs Mining 5
    expect(boardFor(s, 'corporate', now).offers).toEqual([]);
  });

  it('pays 130% of value in credits and 80% as rep', () => {
    const s = newGame();
    const offers = boardFor(s, 'authority', now).offers;
    const i = offers.findIndex((o) => o.item === 'copper');
    expect(offers[i]).toMatchObject({ amount: 300, credits: 780, rep: 480 });
    expect(offers.find((o) => o.item === 'bronze')).toMatchObject({ amount: 100, credits: 1300, rep: 800 });
    expect(deliverContract(s, 'authority', i, now)).toMatchObject({ ok: false, reason: 'Need 300 more Copper' });
    addItem(s.inventory, 'copper', 10, 300);
    expect(deliverContract(s, 'authority', i, now)).toEqual({ ok: true });
    expect(s.credits).toBe(780);
    expect(s.rep.authority).toBe(480);
    expect(deliverContract(s, 'authority', i, now)).toMatchObject({ ok: false, reason: 'Already delivered' });
  });

  it('counts down to the next board', () => {
    expect(msToNextBoard(now)).toBe(CONTRACT_WINDOW_MS - 1000);
  });
});
