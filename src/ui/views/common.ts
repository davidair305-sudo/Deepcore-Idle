import { getItem } from '../../data/items';
import type { SkillId } from '../../data/types';
import { COLONIES, SKILLS, getColony } from '../../data/world';
import { actionTimeMs, level, momentum, skillOf, targetName } from '../../engine/actions';
import { averageQuality, countItem } from '../../engine/inventory';
import { qualityTier } from '../../engine/quality';
import { colonyFee, rankForRep, rankProgress } from '../../engine/reputation';
import type { ActionKind, GameState, QueueStep } from '../../engine/state';
import { levelProgress } from '../../engine/xp';
import { duration, esc, fmt, pct } from '../format';
import { itemIcon as icon } from '../icons';
import { store } from '../store';
import { ui, type Route } from '../uiState';

// Pieces shared by every screen: header, sidebar, right column, cards.

export const ROUTE_NAMES: Record<Route, string> = {
  map: 'Belt map',
  mining: 'Mining quarter',
  refining: 'Refinery',
  crafting: 'Workshop',
  stall: 'Trade ring',
  market: 'Market',
  board: 'Task board',
  inventory: 'Inventory',
  hangar: 'Hangar',
};

const SKILL_ROUTE: Record<SkillId, Route> = { mining: 'mining', refining: 'refining', crafting: 'crafting', trading: 'stall' };

export function header(s: GameState): string {
  const c = getColony(s.colony);
  const r = rankForRep(s.rep[s.colony]);
  return `<header class="hud">
    <div class="brand"><span class="logo" aria-hidden="true"></span>DEEPCORE</div>
    <div class="where"><small>You are here</small><b>${esc(c.shortName === 'Authority' ? 'Deepcore Colony' : c.name)} <i>›</i> ${ROUTE_NAMES[ui.route]}</b></div>
    <div class="badge">Fee ${pct(colonyFee(s.colony, s.rep[s.colony]))} · Rank ${r}</div>
    <button class="btn amber" data-act="route" data-to="map">Map</button>
    <div class="credits"><small>Credits</small><b class="num" data-live="credits">${fmt(s.credits)} CR</b></div>
  </header>`;
}

export function sidebar(s: GameState): string {
  const skills = SKILLS.map(({ id, name }) => {
    const on = ui.route === SKILL_ROUTE[id];
    return `<button class="side-skill${on ? ' on' : ''}" data-act="route" data-to="${SKILL_ROUTE[id]}">
      <span>${name}</span><b class="num">${level(s, id)}/99</b>
      <span class="thin"><i style="width:${(levelProgress(s.xp[id]) * 100).toFixed(1)}%"></i></span>
    </button>`;
  }).join('');
  const links: [Route, string][] = [
    ['market', 'Market'],
    ['board', 'Task board'],
    ['stall', 'Stall'],
    ['inventory', 'Inventory'],
    ['hangar', 'Hangar'],
  ];
  return `<nav class="side" aria-label="Game sections">
    <div class="label">Skills</div>${skills}
    <div class="label">Colony</div>
    ${links.map(([r, n]) => `<button class="side-link${ui.route === r ? ' on' : ''}" data-act="route" data-to="${r}">${n}</button>`).join('')}
  </nav>`;
}

/** Banner at the top of each screen (mood board "scene header"). */
export function banner(kicker: string, title: string, right?: [string, string]): string {
  return `<section class="banner"><div><small>${esc(kicker)}</small><h1>${esc(title)}</h1></div>${
    right ? `<div class="banner-r"><small>${esc(right[0])}</small><b class="num">${esc(right[1])}</b></div>` : ''
  }</section>`;
}

export function qualityLabel(stacks: Record<number, number> | undefined): string {
  if (!stacks || Object.keys(stacks).length === 0) return '';
  const avg = averageQuality(stacks);
  return `q${Math.round(avg)} ${qualityTier(avg).name}`;
}

export function have(s: GameState, id: string): string {
  return `${fmt(countItem(s.inventory, id))}`;
}

const VERB: Record<ActionKind, string> = { mine: 'Mining', refine: 'Refining', craft: 'Crafting', sell: 'Selling at' };

function stepLabel(step: Pick<QueueStep, 'kind' | 'target' | 'colony'>): string {
  return `${VERB[step.kind]} ${targetName(step)} · ${getColony(step.colony).shortName}`;
}

/** The running action plus the rest of the queue. */
export function queuePanel(s: GameState): string {
  const cur = s.queue[0];
  const head = cur
    ? `<div class="now">
        <div class="now-t">${esc(stepLabel(cur))}</div>
        <div class="seg" data-live="progress"><i style="width:${Math.min(100, (s.progressMs / actionTimeMs(s, cur)) * 100).toFixed(1)}%"></i></div>
        <div class="chips">
          <span>${SKILLS.find((k) => k.id === skillOf(cur.kind))!.name} <b>${level(s, skillOf(cur.kind))}</b></span>
          <span>Momentum <b>+${Math.round((momentum(s) - 1) * 100)}%</b></span>
          <span>${cur.durationMs != null ? `Time left <b data-live="timeleft">${duration(cur.durationMs - cur.elapsedMs)}</b>` : 'Runs until stopped'}</span>
          <span>Made <b>${fmt(cur.done)}</b></span>
        </div>
      </div>`
    : `<div class="now idle">Idle. Pick an action to start your shift.</div>`;
  const rows = s.queue
    .map(
      (st, i) => `<li${i === 0 ? ' class="run"' : ''}><span>${i + 1}. ${esc(stepLabel(st))}${
        st.durationMs != null ? ` · ${duration(st.durationMs)}` : ''
      }</span><button class="x" data-act="unqueue" data-i="${i}" aria-label="Remove step ${i + 1}">✕</button></li>`,
    )
    .join('');
  const hours = [0, 1, 2, 4, 6, 8, 12];
  return `<section class="panel queue">
    <div class="panel-h"><span>Shift queue</span><span class="num">${s.queue.length}/${s.queueSlots} slots</span></div>
    ${head}
    ${s.queue.length ? `<ol class="qlist">${rows}</ol>` : ''}
    <div class="qctl">
      <label>Time limit for steps you add
        <select data-act="qhours">${hours
          .map((h) => `<option value="${h}"${ui.queueHours === h ? ' selected' : ''}>${h === 0 ? 'Until stopped' : `${h} h`}</option>`)
          .join('')}</select>
      </label>
      ${s.queue.length ? '<button class="btn ghost sm" data-act="stopall">Stop all</button>' : ''}
    </div>
    ${s.queueSlots < 2 ? '<p class="note">More queue slots come from your ship: the Shift Scheduler and the Nav Computer.</p>' : ''}
  </section>`;
}

export function standingPanel(s: GameState): string {
  return `<section class="panel">
    <div class="panel-h"><span>Colony standing</span></div>
    ${COLONIES.map((c) => {
      const rep = s.rep[c.id];
      const r = rankForRep(rep);
      const p = rankProgress(rep);
      const cells = Array.from({ length: 12 }, (_, i) => `<i${i < Math.round(p * 12) ? ' class="on"' : ''}></i>`).join('');
      return `<div class="stand${c.id === s.colony ? ' here' : ''}">
        <div class="stand-h"><span>${esc(c.shortName)}</span><b class="num">Rank ${r}${r < 10 ? ` · ${Math.floor(p * 100)}%` : ' · max'}</b></div>
        <div class="cells">${cells}</div>
        <small>Fee ${pct(colonyFee(c.id, rep))}${r < 10 ? ` → ${pct(colonyFee(c.id, 25_000 * (r + 1) ** 2))} at next rank` : ''}</small>
      </div>`;
    }).join('')}
  </section>`;
}

export function logPanel(): string {
  const rows = store.log
    .slice(0, 12)
    .map((e) => {
      const t = new Date(e.at);
      const hh = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      return `<li class="${e.tone}">[${hh}] ${esc(e.text)}</li>`;
    })
    .join('');
  return `<section class="panel log"><div class="panel-h"><span>Ops log</span></div><ul>${rows || '<li>Nothing yet.</li>'}</ul></section>`;
}

export function rightColumn(s: GameState): string {
  return `<aside class="rcol">${queuePanel(s)}${standingPanel(s)}${logPanel()}</aside>`;
}

/** An item card's icon + name block. */
export function itemHead(id: string, sub: string): string {
  return `<div class="ihead">${iconBox(id)}<div><h3>${esc(getItem(id).name)}</h3><p class="num">${sub}</p></div></div>`;
}

export function iconBox(id: string): string {
  return `<span class="icbox">${icon(id)}</span>`;
}


/** Start and (when slots allow) queue buttons for an action. */
export function actionButtons(s: GameState, kind: ActionKind, target: string, blocked: string | null): string {
  const running = s.queue[0]?.kind === kind && s.queue[0]?.target === target && s.queue[0]?.colony === s.colony;
  if (blocked) return `<button class="btn locked" disabled>${esc(blocked)}</button>`;
  const start = running
    ? `<button class="btn ghost" data-act="stopall">Stop</button>`
    : `<button class="btn amber" data-act="start" data-kind="${kind}" data-target="${target}">Start</button>`;
  const queue = s.queueSlots > 1 ? `<button class="btn ghost" data-act="enqueue" data-kind="${kind}" data-target="${target}">+ Queue</button>` : '';
  return `<div class="acts">${start}${queue}</div>`;
}
