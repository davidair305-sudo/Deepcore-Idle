import type { Colony, ColonyId, Kit, Recipe, SkillId } from './types';

export const SKILLS: readonly { id: SkillId; name: string }[] = [
  { id: 'mining', name: 'Mining' },
  { id: 'refining', name: 'Refining' },
  { id: 'crafting', name: 'Crafting' },
  { id: 'trading', name: 'Trading' },
];

// GDD "Colonies, reputation and fees". Demand multipliers match the v9 prototype.
export const COLONIES: readonly Colony[] = [
  {
    id: 'authority',
    name: 'Deepcore Colony Authority',
    shortName: 'Authority',
    ores: ['copper', 'tin', 'iron', 'nickel', 'cobalt'],
    bars: ['bronze', 'steel', 'cobaltSteel'],
    startingFee: 0.6,
    hasBroker: true,
    demand: { bar: 0.9 },
    note: 'Home colony. The only place with a broker.',
  },
  {
    id: 'union',
    name: "Miners' Union Deepshafts",
    shortName: 'Union',
    ores: ['cobalt', 'silicate', 'ferrocite', 'titanium', 'gravium'],
    bars: ['cobaltSteel', 'ferroTitanium'],
    startingFee: 0.75,
    hasBroker: false,
    demand: { ore: 0.95, bar: 1.1, part: 1.15 },
    note: 'Pays 10% more for bars and 15% more for ship parts.',
  },
  {
    id: 'corporate',
    name: 'Corporate Claim',
    shortName: 'Corporate',
    ores: ['gravium', 'cryolite', 'palladium', 'nullstone'],
    bars: ['ferroTitanium', 'gravsteel'],
    startingFee: 0.85,
    hasBroker: false,
    demand: { ore: 1.05, gem: 1.3, jewelry: 1.3 },
    note: 'Pays 30% more for gems and jewelry and 5% more for ore.',
  },
];

export const HOME_COLONY: ColonyId = 'authority';

export function getColony(id: ColonyId): Colony {
  const c = COLONIES.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown colony id: ${id}`);
  return c;
}

// GDD "Data tables" → Mining kits.
export const KITS: readonly Kit[] = [
  { id: 'starterKit', name: 'Starter Kit', miningLevel: 1, yieldMultiplier: 1.0, price: 0 },
  { id: 'bronzeKit', name: 'Bronze Kit', miningLevel: 12, yieldMultiplier: 1.1, price: 2_500 },
  { id: 'steelKit', name: 'Steel Kit', miningLevel: 28, yieldMultiplier: 1.2, price: 8_000 },
  { id: 'cobaltSteelKit', name: 'Cobalt Steel Kit', miningLevel: 50, yieldMultiplier: 1.3, price: 25_000 },
  { id: 'ferroTitaniumKit', name: 'Ferro-Titanium Kit', miningLevel: 75, yieldMultiplier: 1.4, price: 60_000 },
  { id: 'gravsteelKit', name: 'Gravsteel Kit', miningLevel: 85, yieldMultiplier: 1.5, price: 150_000 },
];

/** Rank in a colony needed to use that colony's kit trader. */
export const KIT_TRADER_RANK = 4;

export interface OilStep {
  readonly name: string;
  readonly text: string;
  readonly deliver?: Recipe;
  /** Credits of stall sales (self-made goods only) needed for the token. */
  readonly salesValue?: number;
  readonly handInToken?: boolean;
  readonly reward: {
    readonly rep?: number;
    readonly credits?: number;
    readonly xp?: { readonly skill: SkillId; readonly amount: number };
    readonly kit?: string;
    readonly token?: boolean;
    readonly oilDepot?: boolean;
    /** PLAN.md 3a: the hangar opens after step 2. */
    readonly hangar?: boolean;
  };
}

// GDD "Oil depot chain rewards". Reputation goes to the Authority.
export const OIL_CHAIN: readonly OilStep[] = [
  {
    name: 'Ore for the depot',
    text: 'Deliver copper and tin to start the oil depot.',
    deliver: { copper: 600, tin: 600 },
    reward: { rep: 10_000, xp: { skill: 'mining', amount: 2_000 }, kit: 'bronzeKit' },
  },
  {
    name: 'Bronze for the scaffold',
    text: 'Refine bronze bars for the depot frame.',
    deliver: { bronze: 300 },
    reward: { rep: 15_000, credits: 1_500, xp: { skill: 'refining', amount: 3_000 }, hangar: true },
  },
  {
    name: 'Fittings for the pumps',
    text: 'Craft fittings and plating for the pump housing.',
    deliver: { bronzeFittings: 100, steelPlating: 40 },
    reward: { rep: 25_000, credits: 4_000, xp: { skill: 'crafting', amount: 3_000 }, kit: 'steelKit' },
  },
  {
    name: 'Open for business',
    text: 'Sell 25,000 credits of goods you made at your stall to earn the depot token.',
    salesValue: 25_000,
    reward: { token: true },
  },
  {
    name: 'Hand in the token',
    text: 'Turn in the depot token to open the oil depot.',
    handInToken: true,
    reward: { rep: 40_000, oilDepot: true },
  },
];
