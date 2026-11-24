// Screen-only state (not saved): which screen is open and form choices.

export type Route = 'map' | 'mining' | 'refining' | 'crafting' | 'stall' | 'city' | 'inventory' | 'hangar' | 'settings';
export type CityTab = 'mission' | 'tasks' | 'present';
export type TradeTab = 'stall' | 'broker' | 'kits';
/** Sites on the asteroid map: the three colonies, the oil fields and the abandoned colony. */
export type MapSite = 'authority' | 'union' | 'corporate' | 'oil' | 'abandoned';

export const ui = {
  route: 'map' as Route,
  cityTab: 'mission' as CityTab,
  tradeTab: 'stall' as TradeTab,
  /** Site highlighted in the map's side panel (defaults to where you are). */
  mapSite: null as MapSite | null,
  /** Item picked in the stall's inventory grid. */
  stallItem: null as string | null,
  /** Time limit (hours) for the next step added to the queue; 0 = until stopped. */
  queueHours: 0,
  /** Amounts typed into cash-out rows, by item id. */
  amounts: {} as Record<string, number>,
  /** Inventory item whose quality stacks are expanded. */
  openItem: null as string | null,
  toast: '' as string,
  /** Settings screen: the shown export code, the pasted import code, and the two-tap reset. */
  exportText: '',
  importText: '',
  resetArmed: false,
  /** The return screen has been tapped to skip its animation. */
  rsSkipped: false,
  /** Dev tools (?dev=1 or dev build). Never touch offline time (PLAN.md A2). */
  dev: false,
};
