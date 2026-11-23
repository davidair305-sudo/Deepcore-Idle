import type { ColonyId, SkillId } from '../data/types';
import { HOME_COLONY } from '../data/world';
import type { Inventory, PickOrder } from './inventory';
import type { Ware } from './stall';

/** `sell` runs the market stall (decision D14). */
export type ActionKind = 'mine' | 'refine' | 'craft' | 'sell';

/** One step of the action queue. The first step in the queue is the one running. */
export interface QueueStep {
  readonly kind: ActionKind;
  /** Ore, bar or craftable id; `stall` for a sell step. */
  readonly target: string;
  /** Where the step runs (colonies switch freely, decision D2). */
  readonly colony: ColonyId;
  /**
   * Run for this long, then move to the next step (decision D13). null runs
   * until the player stops it or, for refining and crafting, inputs run out.
   * A mining step that has steps after it must have one, or they'd never start.
   */
  readonly durationMs: number | null;
  /** Time spent on this step so far, ms. */
  elapsedMs: number;
  /** Which input units to use first when refining or crafting. */
  readonly pick: PickOrder;
  /** Outputs made so far in this step (for the return screen). */
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
  /** Wares on the market stall, in selling order. */
  stall: Ware[];
  /** Oil depot story contract (GDD "Contracts"). */
  oil: OilProgress;
  /** Each colony's task board for the current 8 h window (generated when first viewed). */
  boards: Partial<Record<ColonyId, ContractBoard>>;
}

export interface Contract {
  readonly item: string;
  readonly amount: number;
  readonly credits: number;
  readonly rep: number;
  done: boolean;
}

export interface ContractBoard {
  /** floor(time / 8 h) when the board was posted. */
  readonly window: number;
  readonly offers: Contract[];
}

export interface OilProgress {
  /** Index of the current step in OIL_CHAIN; equal to its length when finished. */
  step: number;
  /** Stall sales (credits) counted toward step 4, self-made goods only. */
  sales: number;
  token: boolean;
  hangar: boolean;
  oilDepot: boolean;
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
    stall: [],
    oil: { step: 0, sales: 0, token: false, hangar: false, oilDepot: false },
    boards: {},
  };
}

export const mineKey = (colony: ColonyId, ore: string): string => `${colony}:${ore}`;
