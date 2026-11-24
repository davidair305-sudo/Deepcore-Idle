import { getItem } from '../data/items';

// 8×8 pixel sprites recoloured from a few templates (mood board rule 6:
// "Reuse, don't redraw"). a = shadow, b = body, c = highlight.

const ORE = ['..aaaa..', '.abbbba.', 'abbcbbba', 'abbbbbba', 'abcbbbba', 'abbbbcba', '.abbbba.', '..aaaa..'];
const BAR = ['........', '........', '..aaaaa.', '.abbbbba', 'abccccba', 'abbbbbba', '.aaaaaa.', '........'];
const GEM = ['........', '...aa...', '..abba..', '.abccba.', '.abbbba.', '..abba..', '...aa...', '........'];
const PART = ['.aaaaaa.', 'abbbbbba', 'ab.cc.ba', 'abcbbcba', 'abcbbcba', 'ab.cc.ba', 'abbbbbba', '.aaaaaa.'];
const RING = ['...cc...', '..abba..', '.a....a.', 'a......a', 'a......a', '.a....a.', '..abba..', '........'];

/** Item colours, drawn from the 12-colour palette where possible. */
const COLOUR: Record<string, string> = {
  copper: '#D9793F',
  tin: '#5B6B7C',
  iron: '#A9532C',
  nickel: '#E6E0D2',
  cobalt: '#4FD1E8',
  silicate: '#E6E0D2',
  ferrocite: '#E0453A',
  titanium: '#5B6B7C',
  gravium: '#4FD1E8',
  cryolite: '#4FD1E8',
  palladium: '#FFD66B',
  nullstone: '#2F3B4A',
  bronze: '#D9793F',
  steel: '#5B6B7C',
  cobaltSteel: '#4FD1E8',
  ferroTitanium: '#E0453A',
  gravsteel: '#FFD66B',
  roughGem: '#E0453A',
  polishedGem: '#E0453A',
};

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

function sprite(rows: readonly string[], colour: string): string {
  let rects = '';
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const fill = ch === 'a' ? shade(colour, 0.55) : ch === 'b' ? colour : shade(colour, 1.4);
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`;
    }),
  );
  return `<svg class="ic" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

function rowsFor(id: string): readonly string[] {
  const item = getItem(id);
  if (item.kind === 'ore') return ORE;
  if (item.kind === 'bar') return BAR;
  if (item.kind === 'gem' || id === 'polishedGem') return GEM;
  return item.kind === 'part' ? PART : RING;
}

const colourFor = (id: string): string => COLOUR[id] ?? (getItem(id).kind === 'part' ? '#5B6B7C' : '#F2A93B');

/** Draw an item's 8×8 sprite into a pixel scene (used by the stall's display slots). */
export function drawItem(p: { px: (x: number, y: number, c: string) => void }, id: string, x: number, y: number): void {
  const c = colourFor(id);
  rowsFor(id).forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch !== '.') p.px(x + i, y + j, ch === 'a' ? shade(c, 0.55) : ch === 'b' ? c : shade(c, 1.4));
    }),
  );
}

const cache = new Map<string, string>();

export function itemIcon(id: string): string {
  const hit = cache.get(id);
  if (hit) return hit;
  const svg = sprite(rowsFor(id), colourFor(id));
  cache.set(id, svg);
  return svg;
}
