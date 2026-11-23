import type { ColonyId, SkillId } from '../data/types';
import { HOME_COLONY } from '../data/world';
import type { Inventory, PickOrder } from './inventory';

export type ActionKind = 'mine' | 'refine' | 'craft';

/** One step of the action queue. The first step in the queue is the one running. */
export interface QueueStep {
  readonly kind: ActionKind;
  /** Ore, bar or craftable id. */
  readonly target: string;
  /** Where the step runs (colonies switch freely, decision D2). */
  readonly colony: ColonyId;
  /** Stop after this many outputs; null runs until inputs run out or the player stops it. */
  readonly amount: number | null;
  /** Which input units to use first when refining or crafting. */
  readonly pick: PickOrder;
  /** Outputs made so far in this step. */
  done: number;
}

export interface GameState {
  version: 1;
  xp: Record<SkillId, number>;
  credits: number;
  rep: Record<ColonyId, number>;
  /** Colony the player is looking at. */
  colony: ColonyId;
  inventory: Inventory;
  /** Owned kit ids. The best usable one is equipped automatically. */
  kits: string[];
  queue: QueueStep[];
  /** 1 at the start; the Shift Scheduler and Nav Computer raise it (PLAN.md 3a). */
  queueSlots: number;
  /** Time into the current action, ms. */
  progressMs: number;
  /** Time spent on the current step, ms (drives momentum). */
  momentumMs: number;
  /** Yield lost per mine, keyed `colony:ore`, 0–0.15. */
  depletion: Record<string, number>;
  /** Fractional kept ore carried between actions, keyed by ore id. */
  oreCarry: Record<string, number>;
  /** Remaining time on timed effects from random events, ms. */
  buffs: { richVein: number; slowed: number };
}

export function newGame(): GameState {
  return {
    version: 1,
    xp: { mining: 0, refining: 0, crafting: 0, trading: 0 },
    credits: 0,
    rep: { authority: 0, union: 0, corporate: 0 },
    colony: HOME_COLONY,
    inventory: {},
    kits: ['starterKit'],
    queue: [],
    queueSlots: 1,
    progressMs: 0,
    momentumMs: 0,
    depletion: {},
    oreCarry: {},
    buffs: { richVein: 0, slowed: 0 },
  };
}

export const mineKey = (colony: ColonyId, ore: string): string => `${colony}:${ore}`;
