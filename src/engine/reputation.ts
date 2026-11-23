import type { ColonyId } from '../data/types';
import { getColony } from '../data/world';

// GDD "Reputation ranks": ranks 0–10, rank n needs 25,000 × n² reputation in
// that colony. The fee falls in even steps from the starting fee to 10% at rank 10.

export const MAX_RANK = 10;
export const REP_PER_RANK_UNIT = 25_000;
export const MIN_FEE = 0.1;

export const repForRank = (rank: number): number => REP_PER_RANK_UNIT * rank * rank;

export function rankForRep(rep: number): number {
  let rank = 0;
  while (rank < MAX_RANK && rep >= repForRank(rank + 1)) rank++;
  return rank;
}

export function feeAtRank(startingFee: number, rank: number): number {
  const r = Math.max(0, Math.min(MAX_RANK, rank));
  return startingFee - ((startingFee - MIN_FEE) * r) / MAX_RANK;
}

export const colonyFee = (colony: ColonyId, rep: number): number =>
  feeAtRank(getColony(colony).startingFee, rankForRep(rep));

/** Progress toward the next rank, 0–1 (1 at max rank). */
export function rankProgress(rep: number): number {
  const rank = rankForRep(rep);
  if (rank >= MAX_RANK) return 1;
  const lo = repForRank(rank);
  return (rep - lo) / (repForRank(rank + 1) - lo);
}
