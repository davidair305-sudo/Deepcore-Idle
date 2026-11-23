import type { Bar, Craftable, Gem, Item, Ore } from './types';

// GDD "Data tables" → Ores.
export const ORES: readonly Ore[] = [
  { id: 'copper', name: 'Copper', kind: 'ore', miningLevel: 1, yield: 1.0, xp: 5, value: 2, use: 'Wiring, starter ore' },
  { id: 'tin', name: 'Tin', kind: 'ore', miningLevel: 5, yield: 0.95, xp: 7, value: 3, use: 'Bronze, with copper' },
  { id: 'iron', name: 'Iron', kind: 'ore', miningLevel: 12, yield: 0.85, xp: 10, value: 5, use: 'Steel, hull plating' },
  { id: 'nickel', name: 'Nickel', kind: 'ore', miningLevel: 20, yield: 0.8, xp: 13, value: 7, use: 'Steel alloys' },
  { id: 'cobalt', name: 'Cobalt', kind: 'ore', miningLevel: 28, yield: 0.7, xp: 17, value: 9, use: 'Power cells' },
  { id: 'silicate', name: 'Silicate', kind: 'ore', miningLevel: 33, yield: 0.65, xp: 19, value: 4, use: 'Viewport glass' },
  { id: 'ferrocite', name: 'Ferrocite', kind: 'ore', miningLevel: 40, yield: 0.55, xp: 24, value: 15, use: 'Engine coils' },
  { id: 'titanium', name: 'Titanium', kind: 'ore', miningLevel: 50, yield: 0.4, xp: 30, value: 20, use: 'Ship frames' },
  { id: 'gravium', name: 'Gravium', kind: 'ore', miningLevel: 58, yield: 0.35, xp: 36, value: 30, use: 'Gravity drives' },
  { id: 'cryolite', name: 'Cryolite', kind: 'ore', miningLevel: 65, yield: 0.3, xp: 40, value: 12, use: 'Coolant' },
  { id: 'palladium', name: 'Palladium', kind: 'ore', miningLevel: 75, yield: 0.22, xp: 50, value: 45, use: 'Electronics, jewelry' },
  { id: 'nullstone', name: 'Nullstone', kind: 'ore', miningLevel: 85, yield: 0.1, xp: 75, value: 1, use: 'Joke ore: XP and bragging rights' },
];

// GDD "Data tables" → Bars.
export const BARS: readonly Bar[] = [
  { id: 'bronze', name: 'Bronze bar', kind: 'bar', refiningLevel: 1, recipe: { copper: 1, tin: 1 }, xp: 10, value: 10 },
  { id: 'steel', name: 'Steel bar', kind: 'bar', refiningLevel: 15, recipe: { iron: 2, nickel: 1 }, xp: 25, value: 34 },
  { id: 'cobaltSteel', name: 'Cobalt Steel bar', kind: 'bar', refiningLevel: 30, recipe: { steel: 1, cobalt: 2 }, xp: 45, value: 104 },
  { id: 'ferroTitanium', name: 'Ferro-Titanium bar', kind: 'bar', refiningLevel: 50, recipe: { titanium: 2, ferrocite: 1 }, xp: 70, value: 110 },
  { id: 'gravsteel', name: 'Gravsteel bar', kind: 'bar', refiningLevel: 70, recipe: { palladium: 1, gravium: 2 }, xp: 110, value: 210 },
];

// Value comes from the v9 prototype; the GDD doesn't list it yet (PLAN.md B4).
export const ROUGH_GEM: Gem = { id: 'roughGem', name: 'Rough gem', kind: 'gem', value: 40 };

/** Chance per mining action of a rough gem: 1%, or 3% in mines of level 50+. */
export const gemChance = (ore: Ore): number => (ore.miningLevel >= 50 ? 0.03 : 0.01);

// GDD "Data tables" → Crafting recipes.
export const CRAFTABLES: readonly Craftable[] = [
  { id: 'bronzeFittings', name: 'Bronze fittings', kind: 'part', craftingLevel: 1, recipe: { bronze: 2 }, xp: 15, value: 30 },
  { id: 'steelPlating', name: 'Steel plating', kind: 'part', craftingLevel: 10, recipe: { steel: 2 }, xp: 35, value: 90 },
  { id: 'cargoHoldSection', name: 'Cargo hold section', kind: 'part', craftingLevel: 15, recipe: { bronze: 3, steel: 2 }, xp: 50, value: 140 },
  { id: 'hullFrameSection', name: 'Hull frame section', kind: 'part', craftingLevel: 30, recipe: { steel: 2, cobaltSteel: 2 }, xp: 95, value: 360 },
  { id: 'powerCoreCell', name: 'Power core cell', kind: 'part', craftingLevel: 35, recipe: { cobalt: 3, cobaltSteel: 1 }, xp: 70, value: 190 },
  { id: 'lifeSupportModule', name: 'Life support module', kind: 'part', craftingLevel: 50, recipe: { ferroTitanium: 1, silicate: 3 }, xp: 85, value: 180 },
  { id: 'engineCoil', name: 'Engine coil', kind: 'part', craftingLevel: 65, recipe: { ferroTitanium: 1, cryolite: 2 }, xp: 105, value: 200 },
  { id: 'navCircuit', name: 'Nav circuit', kind: 'part', craftingLevel: 75, recipe: { palladium: 1, silicate: 2 }, xp: 120, value: 120 },
  { id: 'polishedGem', name: 'Polished gem', kind: 'jewelry', craftingLevel: 1, recipe: { roughGem: 1 }, xp: 20, value: 90 },
  { id: 'bronzeGemRing', name: 'Bronze gem ring', kind: 'jewelry', craftingLevel: 10, recipe: { polishedGem: 1, bronze: 1 }, xp: 40, value: 150 },
  { id: 'steelGemAmulet', name: 'Steel gem amulet', kind: 'jewelry', craftingLevel: 25, recipe: { polishedGem: 1, steel: 2 }, xp: 65, value: 240 },
  { id: 'gravsteelGemCirclet', name: 'Gravsteel gem circlet', kind: 'jewelry', craftingLevel: 70, recipe: { polishedGem: 2, gravsteel: 1 }, xp: 160, value: 600 },
];

export const ALL_ITEMS: readonly Item[] = [...ORES, ...BARS, ROUGH_GEM, ...CRAFTABLES];

const BY_ID = new Map<string, Item>(ALL_ITEMS.map((it) => [it.id, it]));

export const isItemId = (id: string): boolean => BY_ID.has(id);

export function getItem(id: string): Item {
  const it = BY_ID.get(id);
  if (!it) throw new Error(`Unknown item id: ${id}`);
  return it;
}
