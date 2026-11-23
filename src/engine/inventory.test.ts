import { describe, expect, it } from 'vitest';
import {
  addItem,
  averageQuality,
  averageQualityOf,
  countItem,
  emptyInventory,
  qualitiesOf,
  removeItem,
  removeRecipe,
} from './inventory';

describe('inventory', () => {
  it('stacks by item and quality', () => {
    const inv = emptyInventory();
    addItem(inv, 'copper', 20, 5);
    addItem(inv, 'copper', 20, 3);
    addItem(inv, 'copper', 35, 2);
    expect(countItem(inv, 'copper')).toBe(10);
    expect(inv.copper).toEqual({ 20: 8, 35: 2 });
    expect(qualitiesOf(inv, 'copper', 'highest')).toEqual([35, 20]);
  });

  it('clamps quality when adding', () => {
    const inv = emptyInventory();
    addItem(inv, 'tin', 140, 1);
    addItem(inv, 'tin', 0, 1);
    expect(inv.tin).toEqual({ 100: 1, 1: 1 });
  });

  it('rejects bad counts', () => {
    expect(() => addItem(emptyInventory(), 'tin', 10, 1.5)).toThrow();
    expect(() => addItem(emptyInventory(), 'tin', 10, -1)).toThrow();
  });

  it('removes lowest or highest quality first', () => {
    const inv = emptyInventory();
    addItem(inv, 'bronze', 10, 2);
    addItem(inv, 'bronze', 50, 2);
    expect(removeItem(inv, 'bronze', 3, 'lowest')).toEqual({ 10: 2, 50: 1 });
    expect(inv.bronze).toEqual({ 50: 1 });

    const inv2 = emptyInventory();
    addItem(inv2, 'bronze', 10, 2);
    addItem(inv2, 'bronze', 50, 2);
    expect(removeItem(inv2, 'bronze', 3, 'highest')).toEqual({ 50: 2, 10: 1 });
  });

  it('changes nothing when short, and cleans up empty items', () => {
    const inv = emptyInventory();
    addItem(inv, 'steel', 40, 1);
    expect(removeItem(inv, 'steel', 2)).toBeNull();
    expect(countItem(inv, 'steel')).toBe(1);
    removeItem(inv, 'steel', 1);
    expect(inv).toEqual({});
  });

  it('removes recipes all-or-nothing', () => {
    const inv = emptyInventory();
    addItem(inv, 'copper', 20, 5);
    addItem(inv, 'tin', 30, 1);
    expect(removeRecipe(inv, { copper: 1, tin: 1 }, 2)).toBeNull();
    expect(countItem(inv, 'copper')).toBe(5);
    const taken = removeRecipe(inv, { copper: 1, tin: 1 });
    expect(taken).toEqual({ copper: { 20: 1 }, tin: { 30: 1 } });
    expect(averageQualityOf(Object.values(taken!))).toBe(25);
  });

  it('averages quality by unit count', () => {
    expect(averageQuality({ 10: 3, 50: 1 })).toBe(20);
    expect(averageQuality({})).toBe(0);
  });
});
