import { seededRng } from '../engine/rng';

// Pixel-art scenes drawn as SVG rectangles (mood board: one pixel scale,
// fixed 12-colour palette, light only from sources). Each scene is drawn
// small and scaled up with crisp edges.

export const P = {
  void: '#07090D',
  hull: '#121821',
  steel: '#1E2733',
  gunmetal: '#2F3B4A',
  plate: '#5B6B7C',
  bone: '#E6E0D2',
  rust: '#A9532C',
  copper: '#D9793F',
  amber: '#F2A93B',
  cyan: '#4FD1E8',
  red: '#E0453A',
  molten: '#FFD66B',
  // Rock browns for the asteroid surface (mixes of the palette's rust and gunmetal).
  rock0: '#2A2522',
  rock1: '#3B3430',
  rock2: '#4A4039',
  rock3: '#5E5248',
} as const;

/** A small pixel canvas that becomes an SVG. Same-colour runs on a row merge into one rect. */
export class Px {
  readonly grid: (string | null)[];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.grid = new Array(w * h).fill(null);
  }
  px(x: number, y: number, c: string): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.grid[y * this.w + x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  /** Draw rows of a sprite: '.' is empty, other characters map through `colours`. */
  sprite(x: number, y: number, rows: readonly string[], colours: Record<string, string>): void {
    rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && colours[ch] && this.px(x + i, y + j, colours[ch]!)));
  }
  /** Copy another canvas onto this one, each pixel scaled to a `scale`×`scale` block. */
  blit(src: Px, x: number, y: number, scale = 1): void {
    for (let j = 0; j < src.h; j++)
      for (let i = 0; i < src.w; i++) {
        const c = src.grid[j * src.w + i];
        if (c) this.rect(x + i * scale, y + j * scale, scale, scale, c);
      }
  }
  svg(cls = 'scene-svg', slice = true): string {
    let out = '';
    for (let y = 0; y < this.h; y++) {
      let x = 0;
      while (x < this.w) {
        const c = this.grid[y * this.w + x];
        let run = 1;
        while (x + run < this.w && this.grid[y * this.w + x + run] === c) run++;
        if (c) out += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${c}"/>`;
        x += run;
      }
    }
    return `<svg class="${cls}" viewBox="0 0 ${this.w} ${this.h}" preserveAspectRatio="${slice ? 'xMidYMid slice' : 'xMidYMid meet'}" shape-rendering="crispEdges" aria-hidden="true">${out}</svg>`;
  }
}

function stars(p: Px, n: number, seed: number, maxY = p.h): void {
  const r = seededRng(seed);
  for (let i = 0; i < n; i++) p.px(r() * p.w, r() * maxY, r() > 0.85 ? P.cyan : r() > 0.5 ? P.plate : P.gunmetal);
}

function hazard(p: Px, x: number, y: number, w: number): void {
  for (let i = 0; i < w; i++) p.px(x + i, y, (i >> 1) % 2 ? P.void : P.amber);
}

// ---------- Skill banners (wide, short) ----------

/** Mining: a lit shaft face with ore seams, beams and a drill rig. */
export function miningScene(oreColours: string[], active: boolean): string {
  const p = new Px(200, 46);
  const r = seededRng(3);
  p.rect(0, 0, 200, 46, P.void);
  // Rock face with texture.
  for (let y = 0; y < 46; y++) for (let x = 0; x < 200; x++) {
    const v = r();
    p.px(x, y, v > 0.9 ? P.rock2 : v > 0.55 ? P.rock1 : P.rock0);
  }
  // Ore seams.
  for (let i = 0; i < 46; i++) {
    const c = oreColours[i % Math.max(1, oreColours.length)] ?? P.copper;
    const x = r() * 196;
    const y = 4 + r() * 30;
    p.rect(x, y, 2, 2, c);
    if (r() > 0.5) p.px(x + 2, y + 1, c);
  }
  // Timber/steel supports.
  for (const x of [18, 70, 122, 174]) {
    p.rect(x, 0, 4, 40, P.gunmetal);
    p.rect(x + 1, 0, 1, 40, P.plate);
  }
  p.rect(0, 2, 200, 3, P.gunmetal);
  p.rect(0, 3, 200, 1, P.rust);
  // Lamps on the beam: the only light source.
  for (const x of [44, 96, 148]) {
    p.rect(x, 5, 3, 2, P.amber);
    p.px(x + 1, 7, P.molten);
  }
  // Floor and rails.
  p.rect(0, 40, 200, 6, P.hull);
  p.rect(0, 41, 200, 1, P.plate);
  for (let x = 2; x < 200; x += 6) p.rect(x, 43, 3, 1, P.gunmetal);
  // Drill rig.
  const rx = 84;
  p.rect(rx, 30, 26, 9, P.gunmetal);
  p.rect(rx + 2, 32, 8, 4, P.cyan);
  p.rect(rx + 26, 33, 12, 3, P.plate);
  p.rect(rx + 38, 32, 4, 5, active ? P.amber : P.plate);
  p.rect(rx + 3, 39, 5, 2, P.steel);
  p.rect(rx + 18, 39, 5, 2, P.steel);
  p.rect(rx + 20, 24, 2, 6, P.plate);
  p.px(rx + 20, 23, active ? P.cyan : P.red);
  if (active) for (let i = 0; i < 10; i++) p.px(rx + 42 + r() * 6, 30 + r() * 9, oreColours[0] ?? P.copper);
  return p.svg();
}

/** Refining: the furnace is the hero; molten colours are the only bright ones. */
export function refiningScene(active: boolean): string {
  const p = new Px(200, 46);
  p.rect(0, 0, 200, 46, P.hull);
  for (let x = 0; x < 200; x += 12) p.rect(x, 0, 1, 40, P.steel);
  for (let y = 0; y < 40; y += 10) p.rect(0, y, 200, 1, P.steel);
  p.rect(0, 5, 200, 2, P.gunmetal);
  p.rect(0, 6, 200, 1, P.copper);
  // Pipes.
  p.rect(30, 0, 3, 40, P.gunmetal);
  p.rect(160, 0, 3, 40, P.gunmetal);
  // Crucible.
  const cx = 100;
  for (let y = 0; y < 18; y++) {
    const half = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 4) / 16) ** 2)) * 18);
    p.rect(cx - half, 18 + y, half * 2, 1, y < 2 ? P.gunmetal : P.steel);
    p.px(cx - half, 18 + y, P.void);
    p.px(cx + half - 1, 18 + y, P.void);
  }
  p.rect(cx - 16, 18, 32, 3, active ? P.copper : P.rust);
  p.rect(cx - 10, 18, 20, 2, active ? P.molten : P.copper);
  for (let x = cx - 14; x < cx + 14; x += 4) p.px(x, 28, P.amber);
  if (active) {
    const r = seededRng(9);
    for (let i = 0; i < 40; i++) p.px(cx - 14 + r() * 28, 6 + r() * 11, r() > 0.5 ? P.molten : P.amber);
  }
  // Ingots.
  p.rect(0, 40, 200, 6, P.void);
  for (let i = 0; i < 4; i++) {
    p.rect(140 + i * 9, 36, 7, 3, P.copper);
    p.rect(140 + i * 9, 36, 7, 1, P.molten);
  }
  for (let i = 0; i < 3; i++) {
    p.rect(144 + i * 9, 33, 7, 3, P.copper);
    p.rect(144 + i * 9, 33, 7, 1, P.molten);
  }
  return p.svg();
}

/** Crafting: workbench with a part under the lamp and sparks. */
export function craftingScene(active: boolean): string {
  const p = new Px(200, 46);
  p.rect(0, 0, 200, 46, P.hull);
  for (let x = 6; x < 200; x += 16) for (let y = 6; y < 30; y += 8) p.px(x, y, P.gunmetal);
  // Tool wall.
  p.rect(20, 8, 50, 18, P.steel);
  for (let i = 0; i < 6; i++) p.rect(24 + i * 7, 10, 2, 10 + (i % 3) * 2, i % 2 ? P.plate : P.gunmetal);
  // Lamp.
  p.rect(108, 0, 1, 8, P.plate);
  p.rect(103, 8, 11, 3, P.gunmetal);
  p.rect(105, 11, 7, 1, P.molten);
  // Bench.
  p.rect(60, 30, 110, 4, P.gunmetal);
  p.rect(60, 30, 110, 1, P.plate);
  p.rect(64, 34, 4, 8, P.steel);
  p.rect(162, 34, 4, 8, P.steel);
  // Part on bench.
  p.rect(96, 24, 24, 6, P.plate);
  p.rect(98, 25, 4, 4, P.cyan);
  p.rect(114, 25, 4, 4, P.gunmetal);
  if (active) {
    const r = seededRng(5);
    for (let i = 0; i < 14; i++) p.px(118 + r() * 12, 16 + r() * 9, r() > 0.4 ? P.molten : P.amber);
  }
  p.rect(0, 42, 200, 4, P.void);
  hazard(p, 0, 42, 200);
  return p.svg();
}

// ---------- Trade ring (taller scene) ----------

export function tradeRingScene(slotSprites: ((p: Px, x: number, y: number) => void)[], customers: number, open: boolean): string {
  const p = new Px(200, 84);
  p.rect(0, 0, 200, 84, P.hull);
  // Dome ribs with lights.
  for (let k = 0; k < 5; k++) {
    for (let x = 0; x < 200; x++) {
      const y = Math.round(6 + k * 7 + ((x - 100) / 100) ** 2 * 26);
      if (y < 50) p.px(x, y, P.steel);
      if (x % 17 === k * 3 && y < 50) p.px(x, y, P.amber);
    }
  }
  // Neighbour stalls.
  const awn = [P.rust, P.cyan, P.gunmetal, P.plate, P.cyan, P.rust];
  [[4, 44], [34, 42], [150, 42], [176, 44]].forEach(([x, y], i) => {
    for (let a = 0; a < 22; a++) p.rect(x! + a, y!, 1, 4, (a >> 2) % 2 ? P.void : awn[i]!);
    p.rect(x!, y! + 4, 22, 12, P.steel);
    for (let d = 2; d < 22; d += 4) p.px(x! + d, y! + 6, P.amber);
  });
  // Floor.
  for (let y = 60; y < 84; y++) for (let x = 0; x < 200; x++) p.px(x, y, ((x >> 3) + (y >> 3)) % 2 ? P.steel : P.gunmetal);
  // Your stall: striped awning, sign, display window.
  const sx = 62;
  for (let a = 0; a < 76; a++) p.rect(sx + a, 26, 1, 12, (a >> 2) % 2 ? P.void : P.amber);
  p.rect(sx, 26, 76, 1, P.rust);
  p.rect(sx + 18, 39, 40, 5, P.void);
  p.rect(sx + 19, 40, 38, 3, P.steel);
  p.rect(sx + 20, 41, 36, 1, open ? P.cyan : P.plate);
  p.rect(sx + 4, 45, 68, 18, P.gunmetal);
  p.rect(sx + 6, 47, 64, 14, P.void);
  for (let i = 0; i < 6; i++) {
    const x = sx + 7 + i * 10;
    p.rect(x, 48, 10, 10, P.steel);
    p.rect(x + 1, 49, 8, 8, P.void);
    const draw = slotSprites[i];
    if (draw) draw(p, x + 1, 49);
    else {
      p.rect(x + 4, 51, 2, 4, P.gunmetal);
      p.rect(x + 3, 52, 4, 2, P.gunmetal);
    }
  }
  hazard(p, sx, 63, 76);
  // Crates.
  p.rect(sx - 10, 64, 9, 9, P.rust);
  p.rect(sx - 9, 65, 7, 7, P.copper);
  p.rect(sx + 80, 66, 9, 9, P.rust);
  p.rect(sx + 81, 67, 7, 7, P.copper);
  // Customers: small figures, more when prices are attractive.
  const r = seededRng(11);
  for (let i = 0; i < customers; i++) {
    const x = r() > 0.5 ? 8 + r() * 48 : 146 + r() * 46;
    const y = 58 + r() * 18;
    const coat = [P.rust, P.void, P.gunmetal, P.copper][i % 4]!;
    p.rect(x, y, 3, 2, P.void);
    p.px(x + 1, y, P.amber);
    p.rect(x, y + 2, 3, 4, coat);
  }
  return p.svg('scene-svg');
}

// ---------- City Center ----------

export function cityCenterScene(): string {
  const p = new Px(200, 84);
  p.rect(0, 0, 200, 84, P.hull);
  for (let x = 0; x < 200; x += 10) p.rect(x, 0, 1, 60, P.steel);
  // Pillars.
  for (const x of [26, 60, 136, 170]) {
    p.rect(x, 0, 6, 60, P.gunmetal);
    p.rect(x + 1, 0, 2, 60, P.plate);
    for (let y = 4; y < 60; y += 8) p.px(x + 4, y, P.bone);
  }
  // Banners with a diamond.
  [[42, P.rust], [74, P.amber], [118, P.amber], [150, P.rust]].forEach(([x, c]) => {
    p.rect(x as number, 4, 10, 22, c as string);
    p.rect((x as number) + 4, 12, 2, 2, P.bone);
    p.px((x as number) + 3, 13, P.bone);
    p.px((x as number) + 6, 13, P.bone);
    p.px((x as number) + 4, 11, P.bone);
    p.px((x as number) + 5, 14, P.bone);
  });
  // Great window with stars and a planet.
  for (let y = 4; y < 44; y++) {
    const half = y < 18 ? Math.round(Math.sqrt(Math.max(0, 1 - ((y - 18) / 14) ** 2)) * 22) : 22;
    p.rect(100 - half, y, half * 2, 1, P.void);
  }
  stars(p, 30, 4, 44);
  for (let y = 0; y < 12; y++) {
    const half = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 6) / 6) ** 2)) * 6);
    p.rect(110 - half, 12 + y, half * 2, 1, y % 3 ? P.copper : P.rust);
  }
  for (let x = 78; x <= 122; x += 11) p.rect(x, 4, 1, 40, P.gunmetal);
  for (let y = 14; y < 44; y += 10) p.rect(78, y, 44, 1, P.gunmetal);
  // Terminal and mission desk.
  p.rect(90, 34, 20, 9, P.cyan);
  for (let y = 36; y < 42; y += 2) p.rect(92, y, 16, 1, P.steel);
  p.rect(70, 46, 60, 3, P.void);
  hazard(p, 70, 46, 60);
  p.rect(70, 49, 60, 11, P.gunmetal);
  // Task board, left.
  p.rect(8, 26, 14, 26, P.void);
  const r = seededRng(2);
  for (let i = 0; i < 9; i++) p.rect(10 + r() * 9, 28 + r() * 20, 3, 3, r() > 0.6 ? P.copper : P.bone);
  // Fan, right.
  for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) {
    const dx = x - 6.5;
    const dy = y - 6.5;
    if (dx * dx + dy * dy < 49) p.px(180 + x, 30 + y, (Math.atan2(dy, dx) * 3) % 1 > 0.5 ? P.plate : P.gunmetal);
  }
  // Floor and people.
  for (let y = 60; y < 84; y++) for (let x = 0; x < 200; x++) p.px(x, y, ((x >> 3) + (y >> 3)) % 2 ? P.steel : P.gunmetal);
  for (const [x, y, c] of [[50, 64, P.rust], [64, 66, P.void], [140, 64, P.copper], [156, 67, P.gunmetal], [84, 40, P.rust], [112, 40, P.rust]] as const) {
    p.rect(x, y, 3, 2, P.void);
    p.px(x + 1, y, P.cyan);
    p.rect(x, y + 2, 3, 5, c);
  }
  return p.svg('scene-svg');
}

// ---------- Hangar ----------

const SHIP = [
  '..........aaaaa...............',
  '.......aaabbbccca.............',
  '.....aabbbbbbcccbbaa..........',
  'eaaabbbbbbbbbbbbbbbbbbaaa.....',
  'eaabbbbbbdbbbbbbbbbbbbbbbbaa..',
  'eeabbbbbbbbbbbbbbbbbbbbbbbbbba',
  'eaabbbbbbbbbbbbbbbbbbbbbbbbaa.',
  'eaaabbbbbbbbbbbbbbbbbbaaa.....',
  '.....aabbbbbbbbbbbbaa.........',
  '.......aaabbbbbbaaa...........',
  '..........aaffaa..............',
];

export function drawShip(p: Px, x: number, y: number): void {
  p.sprite(x, y, SHIP, { a: P.gunmetal, b: P.plate, c: P.cyan, d: P.amber, e: P.copper, f: P.rust });
}

export function hangarScene(hasShip: boolean): string {
  const p = new Px(200, 84);
  p.rect(0, 0, 200, 84, P.steel);
  for (let x = 0; x < 200; x += 10) for (let y = 0; y < 84; y += 10) p.px(x + 5, y + 5, P.plate);
  for (let x = 0; x < 200; x += 10) p.rect(x, 8, 1, 76, P.hull);
  for (let y = 8; y < 84; y += 10) p.rect(0, y, 200, 1, P.hull);
  p.rect(0, 0, 200, 6, P.gunmetal);
  p.rect(0, 2, 200, 1, P.rust);
  for (let x = 10; x < 200; x += 20) p.px(x, 4, P.amber);
  // Hazard walls.
  for (let y = 16; y < 64; y++) {
    p.px(8 + ((y >> 1) % 3), y, P.amber);
    p.px(190 - ((y >> 1) % 3), y, P.amber);
  }
  // Landing pad.
  for (let a = 0; a < 360; a += 3) {
    const rad = (a * Math.PI) / 180;
    const x = 100 + Math.cos(rad) * 40;
    const y = 44 + Math.sin(rad) * 24;
    p.px(x, y, (a / 3) % 4 < 2 ? P.amber : P.void);
    p.px(100 + Math.cos(rad) * 28, 44 + Math.sin(rad) * 16, P.cyan);
  }
  for (let x = 14; x < 186; x += 4) if (x < 58 || x > 142) p.rect(x, 44, 2, 1, P.amber);
  // Crates.
  p.rect(26, 18, 10, 8, P.rust);
  p.rect(38, 20, 7, 6, P.rust);
  p.rect(28, 64, 14, 7, P.red);
  p.rect(160, 16, 12, 8, P.gunmetal);
  p.rect(166, 60, 10, 8, P.rust);
  if (hasShip) {
    // The starter ship at 2× on the pad.
    const ship = new Px(30, 11);
    drawShip(ship, 0, 0);
    p.blit(ship, 70, 33, 2);
  }
  return p.svg('scene-svg');
}

// ---------- Asteroid map ----------

/** The home asteroid: an irregular rock with craters, an ice field and dark oil flats. */
export function asteroidScene(): string {
  const W = 160;
  const H = 96;
  const p = new Px(W, H);
  p.rect(0, 0, W, H, P.void);
  stars(p, 70, 8);
  const r = seededRng(21);
  const noise = (x: number, y: number) =>
    Math.sin(x * 0.11 + 1.3) * Math.cos(y * 0.13 + 0.7) * 0.5 + Math.sin(x * 0.27 + y * 0.19) * 0.3 + Math.sin(x * 0.05 - y * 0.08) * 0.4;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x - 70) / 62;
      const dy = (y - 50) / 42;
      const edge = Math.atan2(dy, dx);
      const rim = 1 + Math.sin(edge * 3 + 0.5) * 0.08 + Math.sin(edge * 7) * 0.04;
      const d = dx * dx + dy * dy;
      if (d > rim * rim) continue;
      const n = noise(x, y) + r() * 0.25;
      p.px(x, y, n > 0.55 ? P.rock3 : n > 0.1 ? P.rock2 : n > -0.35 ? P.rock1 : P.rock0);
      if (d > rim * rim * 0.9) p.px(x, y, P.gunmetal);
    }
  // Craters.
  for (const [cx, cy, rad] of [[36, 40, 5], [92, 70, 6], [60, 20, 4], [116, 38, 3], [74, 52, 3]] as const)
    for (let a = 0; a < 360; a += 12) {
      const rr = (a * Math.PI) / 180;
      p.px(cx + Math.cos(rr) * rad, cy + Math.sin(rr) * rad * 0.8, a > 200 && a < 340 ? P.rock3 : P.rock0);
    }
  // Ice field (cyan specks), top right.
  for (let i = 0; i < 60; i++) p.px(90 + r() * 26, 14 + r() * 20, r() > 0.5 ? P.cyan : P.bone);
  // Oil flats (dark hatched), bottom left.
  for (let y = 66; y < 82; y++) for (let x = 20; x < 46; x++) if ((x + y) % 3 === 0 && noise(x, y) > -0.2) p.px(x, y, P.void);
  // Dark sea of shadow on the night side, right.
  for (let y = 10; y < 90; y++) for (let x = 120; x < 140; x++) if ((x + y) % 2 === 0 && x > 120 + Math.abs(50 - y) * 0.2) p.px(x, y, P.hull);
  // Small abandoned rock off the right edge.
  for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) {
    const dx = (x - 8) / 8;
    const dy = (y - 6) / 6;
    if (dx * dx + dy * dy < 1) p.px(140 + x, 22 + y, r() > 0.5 ? P.rock1 : P.rock2);
  }
  return p.svg('scene-svg', false);
}
