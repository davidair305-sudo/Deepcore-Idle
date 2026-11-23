import { HOME_COLONY } from '../data/world';
import { level } from '../engine/actions';
import { rankForRep } from '../engine/reputation';
import { seededRng } from '../engine/rng';
import { newGame, type GameState } from '../engine/state';
import { advance } from '../engine/tick';
import { CHECK_IN_MS, checkIn } from './bot';

// Runs the twice-a-day bot and records when milestones happen.

export interface Milestones {
  /** Day (from 0) each oil chain step was finished. */
  oilSteps: number[];
  /** Day each home rank was reached, indexed by rank. */
  homeRanks: (number | undefined)[];
  /** Skill levels at the end of each day. */
  daily: { day: number; mining: number; refining: number; crafting: number; trading: number; credits: number; homeRank: number }[];
  final: GameState;
}

export function runSim(days: number, seed = 1): Milestones {
  const s = newGame();
  const rng = seededRng(seed);
  const m: Milestones = { oilSteps: [], homeRanks: [], daily: [], final: s };
  let now = 0;
  const checkIns = Math.round((days * 24 * 3_600_000) / CHECK_IN_MS);
  for (let i = 0; i < checkIns; i++) {
    const day = now / 86_400_000;
    const before = s.oil.step;
    checkIn(s, now);
    for (let k = before; k < s.oil.step; k++) m.oilSteps[k] = day;
    const r = rankForRep(s.rep[HOME_COLONY]);
    for (let k = 1; k <= r; k++) m.homeRanks[k] ??= day;
    advance(s, CHECK_IN_MS, rng);
    now += CHECK_IN_MS;
    if (now % 86_400_000 === 0) {
      m.daily.push({
        day: now / 86_400_000,
        mining: level(s, 'mining'),
        refining: level(s, 'refining'),
        crafting: level(s, 'crafting'),
        trading: level(s, 'trading'),
        credits: Math.round(s.credits),
        homeRank: rankForRep(s.rep[HOME_COLONY]),
      });
    }
  }
  return m;
}
