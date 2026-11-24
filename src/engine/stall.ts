import type { ColonyId } from '../data/types';
import { countItem, removeItem, type PickOrder } from './inventory';
import type { GameState } from './state';
import { marketValue, unitValue } from './value';
import { levelForXp } from './xp';

// The market stall (decision D14). The player lists wares, each with a price
// slider that starts at market price. Wares sell one unit per sale, in list
// order. Running the stall is an action, so it competes with mining time.

export const SALE_TIME_MS = 3000;
/** Stall speed +3% per Trading level (GDD). */
export const STALL_SPEED_PER_LEVEL = 0.03;
export const MIN_PRICE = 0.25;
export const MAX_PRICE = 3;
export const MAX_SPEED = 3;
/** Price (fraction of market) that sells at normal speed: 100% at Trading 1, ~124.5% at 99. */
export const normalSpeedPrice = (tradingLevel: number): number => 1 + 0.0025 * (tradingLevel - 1);
/** Selling at the stall earns reputation worth 20% of the item's value, whatever the price (GDD). */
export const STALL_REP_SHARE = 0.2;

export interface Ware {
  readonly item: string;
  /** Price as a fraction of market value (1 = market price). */
  price: number;
  /** Which quality sells first. */
  pick: PickOrder;
}

export const clampPrice = (p: number): number => Math.max(MIN_PRICE, Math.min(MAX_PRICE, Number.isFinite(p) ? p : 1));

/** How fast a price sells compared to normal speed: higher is slower, lower is faster (max 3×). */
export function saleSpeed(price: number, tradingLevel: number): number {
  const ref = normalSpeedPrice(tradingLevel);
  return Math.min(MAX_SPEED, Math.exp((ref - clampPrice(price)) / ref));
}

const tradingLevel = (s: GameState): number => levelForXp(s.xp.trading);

/** The ware currently selling: the first one in the list that's still in stock. */
export function currentWare(s: GameState): Ware | null {
  return s.stall.find((w) => countItem(s.inventory, w.item) > 0) ?? null;
}

export function saleTimeMs(s: GameState): number {
  const w = currentWare(s);
  const tl = tradingLevel(s);
  const speed = w ? saleSpeed(w.price, tl) : 1;
  return SALE_TIME_MS / (1 + STALL_SPEED_PER_LEVEL * (tl - 1)) / speed;
}

/** Display slots on the stall (mood board: six). */
export const MAX_WARES = 6;

/**
 * Add an item to the stall at market price. Returns false if it's already
 * listed or every display slot is full.
 */
export function listWare(s: GameState, item: string, price = 1, pick: PickOrder = 'lowest'): boolean {
  if (s.stall.some((w) => w.item === item) || s.stall.length >= MAX_WARES) return false;
  s.stall.push({ item, price: clampPrice(price), pick });
  return true;
}

export function setWarePrice(s: GameState, item: string, price: number): void {
  const w = s.stall.find((x) => x.item === item);
  if (w) w.price = clampPrice(price);
}

export function unlistWare(s: GameState, item: string): void {
  s.stall = s.stall.filter((w) => w.item !== item);
}

/** Move a ware up (-1) or down (+1) the selling order. */
export function moveWare(s: GameState, item: string, by: -1 | 1): void {
  const i = s.stall.findIndex((w) => w.item === item);
  const j = i + by;
  if (i < 0 || j < 0 || j >= s.stall.length) return;
  [s.stall[i], s.stall[j]] = [s.stall[j]!, s.stall[i]!];
}

export interface Sale {
  item: string;
  quality: number;
  credits: number;
  rep: number;
}

/** Sell one unit of the current ware. Returns the sale, or null if the stall is empty. */
export function sellOne(s: GameState, colony: ColonyId): Sale | null {
  const w = currentWare(s);
  if (!w) return null;
  const taken = removeItem(s.inventory, w.item, 1, w.pick)!;
  const quality = Number(Object.keys(taken)[0]);
  const credits = marketValue(colony, w.item, quality) * w.price;
  const rep = unitValue(w.item, quality) * STALL_REP_SHARE;
  s.credits += credits;
  s.rep[colony] += rep;
  return { item: w.item, quality, credits, rep };
}

/** Trading XP per sale (v9 prototype): 5 plus half the credits earned. */
export const tradingXpForSale = (credits: number): number => 5 + credits * 0.5;
