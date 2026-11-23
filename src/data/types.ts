// Shared shapes for the game's data tables. Values come from docs/GDD.md
// ("Data tables") unless a comment says otherwise.

export type SkillId = 'mining' | 'refining' | 'crafting' | 'trading';

export type ItemKind = 'ore' | 'bar' | 'gem' | 'part' | 'jewelry';

export type ColonyId = 'authority' | 'union' | 'corporate';

/** Ingredient list: item id -> how many are consumed per action. */
export type Recipe = Readonly<Record<string, number>>;

export interface ItemBase {
  readonly id: string;
  readonly name: string;
  readonly kind: ItemKind;
  /** Base market value in credits, before local demand and quality. */
  readonly value: number;
}

export interface Ore extends ItemBase {
  readonly kind: 'ore';
  readonly miningLevel: number;
  /** Ore per mining action before level, kit, momentum, depletion and fee. */
  readonly yield: number;
  /** Mining XP per action (per action, not per ore). */
  readonly xp: number;
  readonly use: string;
}

export interface Bar extends ItemBase {
  readonly kind: 'bar';
  readonly refiningLevel: number;
  readonly recipe: Recipe;
  readonly xp: number;
}

export interface Gem extends ItemBase {
  readonly kind: 'gem';
}

export interface Craftable extends ItemBase {
  readonly kind: 'part' | 'jewelry';
  readonly craftingLevel: number;
  readonly recipe: Recipe;
  readonly xp: number;
}

export type Item = Ore | Bar | Gem | Craftable;

export interface Kit {
  readonly id: string;
  readonly name: string;
  readonly miningLevel: number;
  readonly yieldMultiplier: number;
  /** Kit trader price in credits; 0 means it's never sold. */
  readonly price: number;
}

export interface Colony {
  readonly id: ColonyId;
  readonly name: string;
  readonly shortName: string;
  readonly ores: readonly string[];
  readonly bars: readonly string[];
  /** Mine fee at rank 0, as a fraction (0.6 = 60%). */
  readonly startingFee: number;
  readonly hasBroker: boolean;
  /** Stall price multiplier per item kind; missing kinds are 1. */
  readonly demand: Readonly<Partial<Record<ItemKind, number>>>;
  readonly note: string;
}
