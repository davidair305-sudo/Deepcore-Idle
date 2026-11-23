import { ROUGH_GEM } from '../data/items';
import { DEPLETION_MAX } from './actions';
import { addItem, countItem, qualitiesOf, removeItem } from './inventory';
import type { Rng } from './rng';
import { mineKey, type ActionKind, type GameState, type QueueStep } from './state';

// GDD "Random events": auto-resolved, ~60% good / 40% bad, always small.
// Chance per completed action matches the v9 prototype (0.3%, ~3–4 an hour).

export const RANDOM_EVENT_CHANCE = 0.003;
export const GOOD_EVENT_SHARE = 0.6;

export interface RandomEvent {
  readonly id: string;
  readonly text: string;
  readonly good: boolean;
}

interface EventDef {
  readonly id: string;
  readonly text: string;
  readonly good: boolean;
  readonly apply: (s: GameState, step: QueueStep) => void;
}

const RICH_VEIN_MS = 3 * 60 * 1000;
const SLOWED_MS = 5 * 60 * 1000;
const INSPECTOR_REP = 150;
const CAVE_IN_DEPLETION = 0.03;
const CRITTER_ORE_LOST = 3;

/** Duplicate one unit of the step's output at the best quality held. */
function bonusOutput(s: GameState, step: QueueStep): void {
  const q = qualitiesOf(s.inventory, step.target, 'highest')[0];
  if (q !== undefined) addItem(s.inventory, step.target, q, 1);
}

/** Lose up to n units of the step's output, worst quality first (losses stay small). */
function loseOutput(s: GameState, step: QueueStep, n: number): void {
  const have = countItem(s.inventory, step.target);
  if (have > 0) removeItem(s.inventory, step.target, Math.min(n, have), 'lowest');
}

const EVENTS: Record<ActionKind, readonly EventDef[]> = {
  mine: [
    { id: 'richVein', text: 'Rich vein found: yield up for a few minutes', good: true, apply: (s) => (s.buffs.richVein = RICH_VEIN_MS) },
    {
      id: 'gemPocket',
      text: 'Lost gem pocket: +1 rough gem',
      good: true,
      apply: (s, step) => addItem(s.inventory, ROUGH_GEM.id, qualitiesOf(s.inventory, step.target, 'highest')[0] ?? 20, 1),
    },
    { id: 'inspector', text: 'Inspector visit: commends your work, +reputation', good: true, apply: (s, step) => (s.rep[step.colony] += INSPECTOR_REP) },
    { id: 'wheelbarrow', text: 'Wheelbarrow broken: slowed for 5 minutes', good: false, apply: (s) => (s.buffs.slowed = SLOWED_MS) },
    {
      id: 'caveIn',
      text: 'Cave-in: this mine depletes faster',
      good: false,
      apply: (s, step) => {
        const k = mineKey(step.colony, step.target);
        s.depletion[k] = Math.min(DEPLETION_MAX, (s.depletion[k] ?? 0) + CAVE_IN_DEPLETION);
      },
    },
    { id: 'critter', text: 'Tunnel critter attack: lost a little ore', good: false, apply: (s, step) => loseOutput(s, step, CRITTER_ORE_LOST) },
  ],
  refine: [
    { id: 'perfectPour', text: 'Perfect pour: one extra bar', good: true, apply: bonusOutput },
    { id: 'flareUp', text: 'Furnace flare-up: lost one bar', good: false, apply: (s, step) => loseOutput(s, step, 1) },
  ],
  craft: [
    { id: 'steadyHands', text: 'Steady hands: one extra item', good: true, apply: bonusOutput },
    { id: 'toolSlip', text: 'Tool slip: one item scrapped', good: false, apply: (s, step) => loseOutput(s, step, 1) },
  ],
};

/** Roll for a random event after an action; applies it and returns it, or null. */
export function rollRandomEvent(s: GameState, step: QueueStep, rng: Rng): RandomEvent | null {
  if (rng() >= RANDOM_EVENT_CHANCE) return null;
  const good = rng() < GOOD_EVENT_SHARE;
  const pool = EVENTS[step.kind].filter((e) => e.good === good);
  const def = pool[Math.floor(rng() * pool.length)]!;
  def.apply(s, step);
  return { id: def.id, text: def.text, good: def.good };
}

export const eventsFor = (kind: ActionKind): readonly RandomEvent[] => EVENTS[kind];
