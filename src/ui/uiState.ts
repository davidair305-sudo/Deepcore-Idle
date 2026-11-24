// Screen-only state (not saved): which screen is open and form choices.

export type Route = 'map' | 'mining' | 'refining' | 'crafting' | 'stall' | 'market' | 'board' | 'inventory' | 'hangar';

export const ui = {
  route: 'map' as Route,
  /** Time limit (hours) for the next step added to the queue; 0 = until stopped. */
  queueHours: 0,
  /** Amounts typed into market rows, by item id. */
  amounts: {} as Record<string, number>,
  /** Inventory item whose quality stacks are expanded. */
  openItem: null as string | null,
  toast: '' as string,
  /** Dev tools (?dev=1 or dev build). Never touch offline time (PLAN.md A2). */
  dev: false,
};
