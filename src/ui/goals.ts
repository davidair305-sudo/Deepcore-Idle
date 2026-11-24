import { getItem } from '../data/items';
import { HOME_COLONY, OIL_CHAIN } from '../data/world';
import { getBar, getCraftable, getOre, level } from '../engine/actions';
import { currentOilStep, oilBlockReason } from '../engine/contracts';
import { countItem } from '../engine/inventory';
import { MAX_RANK, rankForRep, rankProgress } from '../engine/reputation';
import type { GameState } from '../engine/state';
import { levelProgress, xpForLevel } from '../engine/xp';
import { fmt } from './format';
import type { CityTab, Route } from './uiState';

// "What should I do next?" Used by the first-run coach card and the return
// screen's next-goal bar. Follows the oil depot chain, then home standing.

export interface Goal {
  title: string;
  detail: string;
  /** 0–1, or null when there's nothing to measure yet. */
  progress: number | null;
  route: Route;
  cityTab?: CityTab;
  go: string;
}

/** Where an item is made, and the level that gates it. */
function makeHint(s: GameState, id: string): { route: Route; gate: string | null; verb: string } {
  const ore = getOre(id);
  if (ore) return { route: 'mining', verb: 'Mine', gate: level(s, 'mining') < ore.miningLevel ? `Mining ${ore.miningLevel}` : null };
  const bar = getBar(id);
  if (bar) return { route: 'refining', verb: 'Refine', gate: level(s, 'refining') < bar.refiningLevel ? `Refining ${bar.refiningLevel}` : null };
  const c = getCraftable(id)!;
  return { route: 'crafting', verb: 'Craft', gate: level(s, 'crafting') < c.craftingLevel ? `Crafting ${c.craftingLevel}` : null };
}

export function nextGoal(s: GameState): Goal {
  // Very first visit.
  if (s.xp.mining === 0 && s.queue.length === 0 && Object.keys(s.inventory).length === 0)
    return { title: 'Start your first shift', detail: 'Open the Mining quarter and start mining copper. It keeps going while you’re away.', progress: null, route: 'mining', go: 'Go mine' };

  const step = currentOilStep(s);
  const n = s.oil.step + 1;
  const total = OIL_CHAIN.length;
  if (step) {
    const ready = oilBlockReason(s) === null || (s.colony !== HOME_COLONY && oilBlockReason({ ...s, colony: HOME_COLONY }) === null);
    if (ready)
      return { title: `Turn in: ${step.name}`, detail: `Oil depot mission, step ${n} of ${total}. Hand it in at City Center → Mission desk.`, progress: 1, route: 'city', cityTab: 'mission', go: 'Turn in' };
    if (step.deliver) {
      const parts = Object.entries(step.deliver);
      const progress = parts.reduce((a, [id, k]) => a + Math.min(1, countItem(s.inventory, id) / k), 0) / parts.length;
      const [id, k] = parts.find(([i, kk]) => countItem(s.inventory, i) < kk)!;
      const short = k - countItem(s.inventory, id);
      const hint = makeHint(s, id);
      if (hint.gate) {
        // Gated: point at the skill to train, with its own progress.
        const [skill, lvlStr] = hint.gate.split(' ') as [string, string];
        const key = skill.toLowerCase() as 'mining' | 'refining' | 'crafting';
        const target = Number(lvlStr);
        const p = Math.min(1, s.xp[key] / xpForLevel(target));
        return {
          title: `Reach ${hint.gate}`,
          detail: `${getItem(id).name} needs ${hint.gate} (you're ${level(s, key)}). Oil depot step ${n}: ${step.name}.`,
          progress: p,
          route: key === 'mining' ? 'mining' : key === 'refining' ? 'refining' : 'crafting',
          go: 'Train',
        };
      }
      return {
        title: `${hint.verb} ${fmt(short)} more ${getItem(id).name}`,
        detail: `Oil depot step ${n} of ${total}: ${step.name}. ${parts.map(([i, kk]) => `${fmt(Math.min(countItem(s.inventory, i), kk))}/${fmt(kk)} ${getItem(i).name}`).join(' · ')}`,
        progress,
        route: hint.route,
        go: hint.verb,
      };
    }
    if (step.salesValue)
      return {
        title: 'Sell goods at your stall',
        detail: `Oil depot step ${n}: sell ${fmt(step.salesValue)} credits of goods you made at the Trade ring. ${fmt(s.oil.sales)} sold so far.`,
        progress: Math.min(1, s.oil.sales / step.salesValue),
        route: 'stall',
        go: 'Open stall',
      };
  }

  const r = rankForRep(s.rep[HOME_COLONY]);
  if (r < MAX_RANK)
    return {
      title: `Reach rank ${r + 1} at Deepcore Colony`,
      detail: 'Present goods at City Center, deliver contracts and sell at your stall. Each rank lowers the mining fee; rank 10 earns the government vessel.',
      progress: rankProgress(s.rep[HOME_COLONY]),
      route: 'city',
      cityTab: 'present',
      go: 'City Center',
    };
  return {
    title: 'Master your crafts',
    detail: 'Max standing reached. Push your skills toward 99 and better-quality parts.',
    progress: levelProgress(s.xp.crafting),
    route: 'crafting',
    go: 'Workshop',
  };
}
