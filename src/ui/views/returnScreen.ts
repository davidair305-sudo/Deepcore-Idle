import { getItem } from '../../data/items';
import { SKILLS, getColony } from '../../data/world';
import { msToNextBoard } from '../../engine/contracts';
import { countItem } from '../../engine/inventory';
import type { GameState } from '../../engine/state';
import { levelForXp, levelProgress } from '../../engine/xp';
import { duration, esc, fmt } from '../format';
import { nextGoal } from '../goals';
import { itemIcon } from '../icons';
import type { Away } from '../store';

// The return screen (GDD "Idle systems and the return screen"; mood board
// "While you were away"). Shown in order over ~4 s: headline and credits,
// skill bars filling with level bursts, event cards, then the best thing last.
// Tapping anywhere skips to the finished summary.

const STEP = 0.32; // seconds between reveals

export function returnScreen(s: GameState, a: Away, now: number): string {
  const r = a.result;
  let t = 0;
  const at = () => `--d:${(t += STEP).toFixed(2)}s`;

  // --- What was produced ---
  const mined = Object.entries(r.mined).filter(([, m]) => m.gross >= 1);
  const minedRows = mined
    .map(
      ([id, m]) => `<div class="rs-stats rs-in" style="${at()}">
        <div class="rs-stat"><span class="icbox">${itemIcon(id)}</span><div><small>${esc(getItem(id).name)} mined</small><b class="num" data-count="${Math.round(m.gross)}">0</b></div></div>
        <div class="rs-stat"><div><small>Colony fee</small><b class="num red-t" data-count="${Math.round(m.gross - m.kept)}" data-sign="-">0</b></div></div>
        <div class="rs-stat keep"><div><small>You keep</small><b class="num amber-t" data-count="${m.kept}" data-sign="+">0</b></div></div>
      </div>`,
    )
    .join('');
  const changes = Object.keys({ ...s.inventory, ...a.before.inventory })
    .filter((id) => !r.mined[id])
    .map((id) => [id, countItem(s.inventory, id) - countItem(a.before.inventory, id)] as const)
    .filter(([, d]) => d !== 0)
    .sort((x, y) => y[1] - x[1]);
  const made = changes.length
    ? `<div class="rs-made rs-in" style="${at()}">${changes
        .slice(0, 8)
        .map(([id, d]) => `<span class="${d > 0 ? 'up' : 'down'}">${itemIcon(id)} ${d > 0 ? '+' : '−'}${fmt(Math.abs(d))} ${esc(getItem(id).name)}</span>`)
        .join('')}</div>`
    : '';
  const credits = s.credits - a.before.credits;
  const creditsRow =
    credits > 0.5
      ? `<div class="rs-credits rs-in" style="${at()}"><small>Credits earned</small><b class="num amber-t" data-count="${Math.round(credits)}" data-sign="+">0</b><span class="num"> CR</span></div>`
      : '';

  // --- Skills ---
  const skills = SKILLS.filter(({ id }) => s.xp[id] > a.before.xp[id])
    .map(({ id, name }) => {
      const before = levelForXp(a.before.xp[id]);
      const after = levelForXp(s.xp[id]);
      const leveled = after > before;
      const from = leveled ? 0 : levelProgress(a.before.xp[id]);
      const to = levelProgress(s.xp[id]);
      return `<div class="rs-skill rs-in${leveled ? ' lvl' : ''}" style="${at()}" ${leveled ? `data-levelup="${after}"` : ''}>
        <div class="rs-skill-h"><small>Trained while away</small><b class="pix">${name}</b><span class="num">Lv ${after}</span></div>
        <div class="rs-bar"><i style="--from:${(from * 100).toFixed(1)}%;--to:${(to * 100).toFixed(1)}%"></i></div>
        <div class="rs-skill-f"><span class="num">+${fmt(s.xp[id] - a.before.xp[id])} XP</span><span class="num">${Math.round(to * 100)}% to Lv ${after + 1}</span></div>
        ${leveled ? `<div class="rs-burst pix">Level ${after}!</div>` : ''}
      </div>`;
    })
    .join('');

  // --- Events: good ones bright, bad ones small and grey with the loss already taken ---
  // Group repeats ("Rich vein found ×3").
  const grouped = new Map<string, { text: string; good: boolean; n: number }>();
  for (const e of r.events) if (e.type === 'random') {
    const g = grouped.get(e.event.id) ?? { text: e.event.text, good: e.event.good, n: 0 };
    g.n++;
    grouped.set(e.event.id, g);
  }
  const random = [...grouped.values()].map((g) => ({ ...g, text: g.n > 1 ? `${g.text} ×${g.n}` : g.text }));
  const stops = r.events.flatMap((e) => (e.type === 'stepStopped' || e.type === 'stepDone' ? [e] : []));
  const cards = [
    ...random.filter((e) => e.good).slice(0, 4).map((e) => `<div class="rs-card good rs-flip" style="${at()}">${esc(e.text)}</div>`),
    ...random.filter((e) => !e.good).slice(0, 3).map((e) => `<div class="rs-card bad rs-flip" style="${at()}">${esc(e.text)} <em>Already taken.</em></div>`),
    ...stops.slice(0, 3).map((e) =>
      e.type === 'stepStopped'
        ? `<div class="rs-card bad rs-flip" style="${at()}">${esc(e.target === 'stall' ? 'Stall' : getItem(e.target).name)} stopped: ${esc(e.reason)}</div>`
        : `<div class="rs-card good rs-flip" style="${at()}">${esc(e.target === 'stall' ? 'Stall' : getItem(e.target).name)} step finished: ${fmt(e.made)} made</div>`,
    ),
  ].join('');

  // --- Best last ---
  const levels = r.events.filter((e) => e.type === 'levelUp');
  const gems = r.events.filter((e) => e.type === 'gem');
  let best = '';
  if (levels.length) {
    const top = levels[levels.length - 1]!;
    const name = SKILLS.find((k) => k.id === (top as { skill: string }).skill)!.name;
    best = `<div class="rs-best rs-in" style="${at()}"><small>Best of the shift</small><b class="pix">${name} level ${(top as { level: number }).level}</b><span>${levels.length} level-up${levels.length > 1 ? 's' : ''} while you were away</span></div>`;
  } else if (gems.length) {
    const q = Math.max(...gems.map((g) => (g as { quality: number }).quality));
    best = `<div class="rs-best rs-in" style="${at()}"><small>Best of the shift</small><b class="pix">${gems.length} rough gem${gems.length > 1 ? 's' : ''}</b><span>Best quality ${q}. Polish them in the Workshop.</span></div>`;
  }

  // --- Next goal and timers ---
  const g = nextGoal(s);
  const cur = s.queue[0];
  const timers = [
    cur ? (cur.durationMs != null ? `Current step ends in ${duration(cur.durationMs - cur.elapsedMs)}` : `Still running: ${cur.kind === 'sell' ? 'your stall' : getItem(cur.target).name}`) : 'Nothing running: pick a new action',
    `New contracts in ${duration(msToNextBoard(now))}`,
  ];
  const colony = getColony(a.colony);

  return `<div class="rs" role="dialog" aria-modal="true" aria-labelledby="rs-title" data-act="rs-skip">
    <div class="rs-panel">
      <div class="rs-top">
        <div><small class="kicker">Shift report // ${esc(colony.id === 'authority' ? 'Deepcore Colony' : colony.name)}</small>
          <h2 id="rs-title" class="rs-title">Welcome back, miner.</h2>
          <p class="num rs-away">Away ${duration(a.awayMs)}${a.effectiveMs < a.awayMs - 60_000 ? ` <span class="dim">(counted as ${duration(a.effectiveMs)}: time after 24 h counts at half)</span>` : ''}</p></div>
        <div class="rs-skipwrap"><span class="logo-big" aria-hidden="true"></span><button class="btn ghost sm" data-act="rs-skip">Skip</button></div>
      </div>
      ${creditsRow}${minedRows}${made}
      ${skills ? `<div class="rs-skills">${skills}</div>` : ''}
      ${cards ? `<div class="rs-cards">${cards}</div>` : ''}
      ${best}
      <div class="rs-goal rs-in" style="${at()}">
        <small class="kicker amber-k">Next goal</small><b>${esc(g.title)}</b>
        ${g.progress != null ? `<span class="thin"><i style="width:${(g.progress * 100).toFixed(0)}%"></i></span>` : ''}
        <p class="dim">${timers.map(esc).join(' · ')}</p>
      </div>
      <div class="rs-actions rs-in" style="${at()}">
        <button class="btn amber" data-act="rs-collect">Collect all</button>
        <button class="btn ghost" data-act="rs-goal">${esc(g.go)}</button>
        <button class="btn ghost" data-act="rs-change">Change action</button>
      </div>
      <p class="dim rs-banked">Everything is already banked in your hold.</p>
    </div>
  </div>`;
}
