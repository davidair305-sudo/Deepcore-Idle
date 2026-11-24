import { CRAFTABLES, getItem } from '../../data/items';
import type { ColonyId } from '../../data/types';
import { COLONIES, HOME_COLONY, KITS, KIT_TRADER_RANK, OIL_CHAIN, getColony } from '../../data/world';
import { MINE_TIME_MS, actionTimeMs, blockReason, equippedKit, getBar, getOre, keptOrePerAction, level } from '../../engine/actions';
import { boardFor, currentOilStep, msToNextBoard, oilBlockReason } from '../../engine/contracts';
import { countItem, qualitiesOf } from '../../engine/inventory';
import { qualityTier } from '../../engine/quality';
import { colonyFee, rankForRep, rankProgress } from '../../engine/reputation';
import { MAX_WARES, currentWare, normalSpeedPrice, saleSpeed, saleTimeMs } from '../../engine/stall';
import type { ActionKind, GameState, QueueStep } from '../../engine/state';
import { marketValue, unitValue } from '../../engine/value';
import { esc, fmt, money, pct } from '../format';
import { drawItem, itemIcon } from '../icons';
import { P, Px, asteroidScene, cityCenterScene, craftingScene, hangarScene, miningScene, refiningScene, tradeRingScene } from '../pixel';
import { ui, type MapSite } from '../uiState';
import { actionButtons, banner, iconBox, itemHead, qualityLabel } from './common';

const fakeStep = (s: GameState, kind: ActionKind, target: string): QueueStep => ({
  kind,
  target,
  colony: s.colony,
  durationMs: null,
  pick: 'lowest',
  elapsedMs: 0,
  done: 0,
});

const perHour = (ms: number) => 3_600_000 / ms;
const running = (s: GameState, kind: ActionKind) => s.queue[0]?.kind === kind;
const colonyLabel = (id: ColonyId) => (id === HOME_COLONY ? 'Deepcore Colony' : getColony(id).name);

function tabs<T extends string>(act: string, current: T, list: [T, string][]): string {
  return `<div class="tabs" role="tablist">${list
    .map(([id, name]) => `<button role="tab" aria-selected="${id === current}" class="tab${id === current ? ' on' : ''}" data-act="${act}" data-tab="${id}">${name}</button>`)
    .join('')}</div>`;
}

// ---------- Asteroid map (mood board "Asteroid map") ----------

interface Site {
  id: MapSite;
  name: string;
  /** Position on the map, percent. */
  x: number;
  y: number;
}

const SITES: Site[] = [
  { id: 'authority', name: 'Deepcore Colony', x: 27, y: 52 },
  { id: 'union', name: "Miners' Union", x: 40, y: 30 },
  { id: 'corporate', name: 'Corporate Claim', x: 62, y: 66 },
  { id: 'oil', name: 'Oil fields', x: 22, y: 77 },
  { id: 'abandoned', name: 'Abandoned colony', x: 92, y: 29 },
];

function siteState(s: GameState, id: MapSite): 'here' | 'open' | 'locked' | 'ship' {
  if (id === 'abandoned') return 'ship';
  if (id === 'oil') return s.oil.oilDepot ? 'open' : 'locked';
  return s.colony === id ? 'here' : 'open';
}

function sitePanel(s: GameState, id: MapSite): string {
  const st = siteState(s, id);
  if (id === 'oil')
    return `<small class="kicker">Deepcore Colony</small><h2 class="site-h">Oil fields</h2><span class="tag ${st === 'open' ? 'cyan' : 'grey'}">${st === 'open' ? 'Open' : 'Locked'}</span>
      <p>The only oil on the asteroid. ${s.oil.oilDepot ? 'Your depot is built. Extracting oil and refining fuel arrive with the ship build.' : 'The Authority opens it when you finish the <b>oil depot</b> mission at City Center.'}</p>`;
  if (id === 'abandoned')
    return `<small class="kicker">Off the asteroid</small><h2 class="site-h">Abandoned colony</h2><span class="tag grey">Needs a ship</span>
      <p>An empty claim on a small rock past the night side: no fees, no rules, no one to ask. You'll need a ship that can launch, and some luck, to get there. Your first destination once you leave the asteroid.</p>`;
  const c = getColony(id);
  const rep = s.rep[id];
  const r = rankForRep(rep);
  const cells = Array.from({ length: 16 }, (_, i) => `<i${i < Math.round(rankProgress(rep) * 16) ? ' class="on"' : ''}></i>`).join('');
  const can = [
    `Mining: ${c.ores.map((o) => getItem(o).name.toLowerCase()).join(', ')}`,
    `Refining: ${c.bars.map((b) => getItem(b).name.replace(' bar', '').toLowerCase()).join(', ')} bars`,
    `Trade ring: your stall${c.hasBroker ? ' and the broker' : ''}`,
    `City Center: task board${id === HOME_COLONY ? ', the oil depot mission' : ''}, presenting goods`,
  ];
  return `<small class="kicker">${id === HOME_COLONY ? 'Home colony' : 'Colony'}</small><h2 class="site-h">${esc(colonyLabel(id))}</h2>
    ${st === 'here' ? '<span class="tag amber">You are here</span>' : ''}
    <div class="duo"><div class="stat"><small>Colony fee</small><b class="num amber-t">${pct(colonyFee(id, rep))}</b></div><div class="stat"><small>Your standing</small><b class="num cyan-t">Rank ${r}</b></div></div>
    <div class="cells big">${cells}</div>
    <h3 class="kicker amber-k">What you can do here</h3>
    <ul class="can">${can.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <p class="dim">${esc(c.note)} Standing here is separate from every other colony.</p>`;
}

export function mapScreen(s: GameState): string {
  const sel = ui.mapSite ?? s.colony;
  const markers = SITES.map((site) => {
    const st = siteState(s, site.id);
    return `<button class="site ${st}${sel === site.id ? ' sel' : ''}" style="left:${site.x}%;top:${site.y}%" data-act="site" data-site="${site.id}">
      <i aria-hidden="true"></i><span>${esc(site.name)}</span></button>`;
  }).join('');
  const st = siteState(s, sel);
  const btn =
    st === 'here'
      ? `<button class="btn ghost wide" data-act="back-to-work">Back to work</button>`
      : st === 'open' && sel !== 'oil'
        ? `<button class="btn amber wide" data-act="enter" data-colony="${sel}">Go here</button>`
        : '';
  return `<div class="mapwrap">
    <div class="mapcol">
      <div class="mapbox">${asteroidScene()}${markers}</div>
      <div class="legend"><span><i class="d here"></i>You are here</span><span><i class="d open"></i>Open</span><span><i class="d locked"></i>Locked</span><span><i class="d ship"></i>Needs a ship</span></div>
    </div>
    <aside class="sitepanel">${sitePanel(s, sel)}${btn}</aside>
  </div>`;
}

// ---------- Skill screens ----------

export function miningScreen(s: GameState): string {
  const c = getColony(s.colony);
  const cards = c.ores
    .map((id) => {
      const ore = getOre(id)!;
      const blocked = blockReason(s, fakeStep(s, 'mine', id));
      const kept = keptOrePerAction(s, s.colony, ore) * perHour(MINE_TIME_MS);
      const on = s.queue[0]?.kind === 'mine' && s.queue[0].target === id && s.queue[0].colony === s.colony;
      const dep = s.depletion[`${s.colony}:${id}`] ?? 0;
      return `<article class="card${on ? ' on' : ''}${blocked ? ' lock' : ''}">
        ${itemHead(id, `${ore.xp} XP · ${fmt(kept)}/h kept`)}
        <p class="dim">Value ${ore.value} cr · depletion ${pct(dep)} · banked ${fmt(countItem(s.inventory, id))}</p>
        ${actionButtons(s, 'mine', id, blocked)}
      </article>`;
    })
    .join('');
  const colours = c.ores.map((o) => ({ copper: P.copper, tin: P.plate, iron: P.rust, nickel: P.bone, cobalt: P.cyan, silicate: P.bone, ferrocite: P.red, titanium: P.plate, gravium: P.cyan, cryolite: P.cyan, palladium: P.molten, nullstone: P.gunmetal })[o] ?? P.copper);
  return `${banner(`${colonyLabel(s.colony)} // Deep shaft`, 'Mining', ['Colony fee', pct(colonyFee(s.colony, s.rep[s.colony]))], miningScene(colours, running(s, 'mine')))}
    <p class="note">Kit: <b>${esc(equippedKit(s).name)}</b> ×${equippedKit(s).yieldMultiplier} · The colony takes its fee from your ore, never your XP. Higher Mining level means better ore quality.</p>
    <div class="cards">${cards}</div>`;
}

function recipeLine(s: GameState, recipe: Readonly<Record<string, number>>): string {
  return Object.entries(recipe)
    .map(([id, n]) => {
      const ok = countItem(s.inventory, id) >= n;
      return `<span class="${ok ? '' : 'short'}">${n} ${esc(getItem(id).name)} (${fmt(countItem(s.inventory, id))})</span>`;
    })
    .join(' + ');
}

export function refiningScreen(s: GameState): string {
  const c = getColony(s.colony);
  const cards = c.bars
    .map((id) => {
      const bar = getBar(id)!;
      const blocked = level(s, 'refining') < bar.refiningLevel ? `Needs Refining ${bar.refiningLevel}` : null;
      const on = s.queue[0]?.kind === 'refine' && s.queue[0].target === id;
      const t = actionTimeMs(s, fakeStep(s, 'refine', id));
      return `<article class="card${on ? ' on' : ''}${blocked ? ' lock' : ''}">
        ${itemHead(id, `${bar.xp} XP · ${fmt(perHour(t))}/h`)}
        <p>${recipeLine(s, bar.recipe)}</p>
        <p class="dim">Value ${bar.value} cr · banked ${fmt(countItem(s.inventory, id))} ${qualityLabel(s.inventory[id])}</p>
        ${actionButtons(s, 'refine', id, blocked)}
        ${blocked ? '' : `<button class="btn ghost sm" data-act="npc" data-target="${id}">NPC refines all (keeps 40%)</button>`}
      </article>`;
    })
    .join('');
  return `${banner(`${colonyLabel(s.colony)} // Smelter`, 'Refining', undefined, refiningScene(running(s, 'refine')))}
    <p class="note">Bars keep 70% of their ore's quality at the level requirement, rising to 100% with skill. The NPC refiner is instant but keeps 40% of the bars, pours worse bars and gives no XP.</p>
    <div class="cards">${cards}</div>`;
}

export function craftingScreen(s: GameState): string {
  const card = (id: string) => {
    const item = CRAFTABLES.find((x) => x.id === id)!;
    const blocked = level(s, 'crafting') < item.craftingLevel ? `Needs Crafting ${item.craftingLevel}` : null;
    const on = s.queue[0]?.kind === 'craft' && s.queue[0].target === id;
    return `<article class="card${on ? ' on' : ''}${blocked ? ' lock' : ''}">
      ${itemHead(id, `${item.xp} XP · value ${item.value}`)}
      <p>${recipeLine(s, item.recipe)}</p>
      <p class="dim">Banked ${fmt(countItem(s.inventory, id))} ${qualityLabel(s.inventory[id])}</p>
      ${actionButtons(s, 'craft', id, blocked)}
    </article>`;
  };
  return `${banner('Workshop // Fabrication bay', 'Crafting', undefined, craftingScene(running(s, 'craft')))}
    <p class="note">Each craft rolls botched, standard, fine or masterwork. Higher Crafting means fewer botches; a perfect craft (quality 100) needs top materials and a masterwork roll.</p>
    <h2>Starship parts</h2><div class="cards">${CRAFTABLES.filter((c) => c.kind === 'part').map((c) => card(c.id)).join('')}</div>
    <h2>Gems and jewelry</h2><div class="cards">${CRAFTABLES.filter((c) => c.kind === 'jewelry').map((c) => card(c.id)).join('')}</div>`;
}

// ---------- Trade ring (mood board "Your stall") ----------

function oilTokenStat(s: GameState): string {
  const step = currentOilStep(s);
  if (!step?.salesValue) return '';
  return `<div class="stat wide"><small>Oil depot mission · stall token</small><b class="num cyan-t">${fmt(s.oil.sales)} / ${fmt(step.salesValue)} CR sold</b><span class="thin"><i style="width:${Math.min(100, (s.oil.sales / step.salesValue) * 100)}%"></i></span></div>`;
}

function stallTab(s: GameState): string {
  const tl = level(s, 'trading');
  const cur = currentWare(s);
  const open = running(s, 'sell');
  const est = cur ? perHour(saleTimeMs(s)) * marketValue(s.colony, cur.item, qualitiesOf(s.inventory, cur.item, cur.pick)[0] ?? 1) * cur.price : 0;
  const avgSpeed = s.stall.length ? s.stall.reduce((a, w) => a + saleSpeed(w.price, tl), 0) / s.stall.length : 0;
  const customers = open ? Math.max(2, Math.round(3 + avgSpeed * 5)) : 2;

  // Inventory grid: tap an item, then put it on the stall.
  const ids = Object.keys(s.inventory);
  const sel = ui.stallItem && ids.includes(ui.stallItem) ? ui.stallItem : (ids[0] ?? null);
  const grid = ids
    .map((id) => {
      const listed = s.stall.some((w) => w.item === id);
      return `<button class="tile${id === sel ? ' sel' : ''}" data-act="stall-pick" data-item="${id}">${listed ? '<span class="tag amber">On stall</span>' : ''}${iconBox(id)}<span>${esc(getItem(id).name)}</span><b class="num cyan-t">×${fmt(countItem(s.inventory, id))}</b></button>`;
    })
    .join('');

  let panel = '<p class="note">Your hold is empty. Mine something first.</p>';
  if (sel) {
    const w = s.stall.find((x) => x.item === sel);
    const q = qualitiesOf(s.inventory, sel, w?.pick ?? 'lowest')[0] ?? 1;
    const price = w?.price ?? 1;
    const each = marketValue(s.colony, sel, q) * price;
    const speed = saleSpeed(price, tl);
    panel = `<div class="ihead">${iconBox(sel)}<div><small class="kicker">${getItem(sel).kind} · you have ${fmt(countItem(s.inventory, sel))}</small><h3 class="pix">${esc(getItem(sel).name)}</h3></div></div>
      <p class="dim">${qualityLabel(s.inventory[sel])} · next unit sold is quality ${q}</p>
      <small class="kicker">Your price per unit</small>
      <div class="price"><b class="num amber-t">${money(each)} CR</b><span class="num">${Math.round(price * 100)}% · ${speed.toFixed(2)}× speed</span></div>
      ${w ? `<label class="slider"><span class="sr">Price</span><input type="range" min="25" max="300" step="5" value="${Math.round(price * 100)}" data-act="price" data-item="${sel}"></label>
        <p class="dim">Market price is 100%. Lower prices sell faster.</p>
        <div class="acts"><button class="btn ghost sm" data-act="ware-reset" data-item="${sel}">Market price</button><button class="btn ghost sm" data-act="ware-up" data-item="${sel}">Sell sooner</button><button class="btn ghost sm" data-act="ware-down" data-item="${sel}">Sell later</button></div>
        <button class="btn ghost wide" data-act="unlist" data-item="${sel}">Take off stall</button>`
        : `<p class="dim">Market price is 100%. Put it on the stall, then slide the price.</p>
        <button class="btn amber wide" data-act="list" data-item="${sel}" ${s.stall.length >= MAX_WARES ? 'disabled' : ''}>${s.stall.length >= MAX_WARES ? 'All 6 slots are full' : 'Put on stall'}</button>`}`;
  }

  const order = s.stall.length
    ? `<ol class="order">${s.stall.map((w) => `<li class="${countItem(s.inventory, w.item) ? '' : 'empty'}">${itemIcon(w.item)} ${esc(getItem(w.item).name)} <span class="num">${Math.round(w.price * 100)}%</span></li>`).join('')}</ol>`
    : '';

  return `<div class="scene-box">${tradeRingScene(s.stall.map((w) => (p: Px, x: number, y: number) => drawItem(p, w.item, x, y)), customers, open)}</div>
    <div class="stats">
      ${actionButtons(s, 'sell', 'stall', s.stall.length && cur ? null : 'Add wares to open')}
      <div class="stat"><small>Est. sales</small><b class="num">${fmt(est)} CR/H</b></div>
      <div class="stat"><small>Customers browsing</small><b class="num">${open ? customers : 0}</b></div>
      ${oilTokenStat(s)}
    </div>
    <div class="stallgrid">
      <section><div class="row-h"><h2>Inventory</h2><span class="dim">Tap an item, then put it on the stall. ${s.stall.length}/${MAX_WARES} slots used.</span></div>
        <div class="tiles">${grid}</div>
        ${order ? `<h2>Selling order</h2><p class="dim">One unit at a time, top first. Normal-speed price at your Trading level: ${pct(normalSpeedPrice(tl))}.</p>${order}` : ''}
      </section>
      <aside class="panel selpanel">${panel}</aside>
    </div>`;
}

function brokerTab(s: GameState): string {
  const c = getColony(s.colony);
  if (!c.hasBroker) return `<p class="note">Only Deepcore Colony has a broker.</p>`;
  return `<p class="note">The broker pays instantly: 60% of value in credits, plus 20% as Authority reputation. The worst-quality units go first.</p>${cashOutTable(s, 'broker')}`;
}

function kitsTab(s: GameState): string {
  const rank = rankForRep(s.rep[s.colony]);
  if (rank < KIT_TRADER_RANK) return `<p class="note">The kit trader only deals with rank ${KIT_TRADER_RANK} miners in ${esc(getColony(s.colony).shortName)}. You're rank ${rank}.</p>`;
  return `<div class="cards">${KITS.filter((k) => k.price > 0)
    .map((k) => {
      const own = s.kits.includes(k.id);
      return `<article class="card${own ? ' on' : ''}"><h3>${esc(k.name)}</h3><p class="num">×${k.yieldMultiplier} yield · Mining ${k.miningLevel}</p><p class="dim">${fmt(k.price)} cr</p>
        <button class="btn ${own ? 'ghost' : 'amber'}" data-act="buykit" data-kit="${k.id}" ${own || s.credits < k.price ? 'disabled' : ''}>${own ? 'Owned' : 'Buy'}</button></article>`;
    })
    .join('')}</div>`;
}

export function stallScreen(s: GameState): string {
  const list: ['stall' | 'broker' | 'kits', string][] = [['stall', 'Your stall'], ['kits', 'Kit trader']];
  if (getColony(s.colony).hasBroker) list.splice(1, 0, ['broker', 'Broker']);
  const tab = list.some(([t]) => t === ui.tradeTab) ? ui.tradeTab : 'stall';
  const body = tab === 'stall' ? stallTab(s) : tab === 'broker' ? brokerTab(s) : kitsTab(s);
  return `${banner(`${colonyLabel(s.colony)} // Trade ring`, 'Trade ring', ['Normal-speed price', pct(normalSpeedPrice(level(s, 'trading')))])}
    ${tabs('trade-tab', tab, list)}${body}`;
}

// ---------- City Center (mood board "City Center") ----------

function cashOutTable(s: GameState, mode: 'donate' | 'broker'): string {
  const ids = Object.keys(s.inventory);
  if (!ids.length) return '<p class="note">Your hold is empty.</p>';
  const rows = ids
    .map((id) => {
      const n = countItem(s.inventory, id);
      const amt = Math.min(n, ui.amounts[id] ?? n);
      const worst = qualitiesOf(s.inventory, id, 'lowest')[0] ?? 1;
      return `<tr>
        <td>${iconBox(id)} ${esc(getItem(id).name)}</td>
        <td class="n">${fmt(n)}</td>
        <td>${qualityLabel(s.inventory[id])}</td>
        <td class="n">${money(unitValue(id, worst))}+</td>
        <td><div class="acts">
          <label class="sr" for="amt-${id}">Amount of ${esc(getItem(id).name)}</label>
          <input class="amt" id="amt-${id}" type="number" min="1" max="${n}" value="${amt}" data-act="amount" data-item="${id}">
          <button class="btn ghost sm" data-act="amt-all" data-item="${id}">All</button>
          <button class="btn sm amber" data-act="${mode}" data-item="${id}">${mode === 'donate' ? 'Present' : 'Sell'}</button>
        </div></td>
      </tr>`;
    })
    .join('');
  return `<div class="scroll"><table><thead><tr><th>Item</th><th>Qty</th><th>Quality</th><th>Value each</th><th>${mode === 'donate' ? 'Present' : 'Sell'}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function missionTab(s: GameState): string {
  if (s.colony !== HOME_COLONY) return `<p class="note">The oil depot mission is posted at the Deepcore Colony mission desk.</p>`;
  const rows = OIL_CHAIN.map((step, i) => {
    const done = i < s.oil.step;
    const cur = i === s.oil.step;
    let prog = done ? 1 : 0;
    let label = done ? 'Done' : cur ? '' : 'Locked';
    if (cur && step.deliver) {
      const parts = Object.entries(step.deliver);
      prog = parts.reduce((a, [id, n]) => a + Math.min(1, countItem(s.inventory, id) / n), 0) / parts.length;
      label = `${Math.round(prog * 100)}%`;
    } else if (cur && step.salesValue) {
      prog = Math.min(1, s.oil.sales / step.salesValue);
      label = `${fmt(s.oil.sales)} / ${fmt(step.salesValue)} CR`;
    } else if (cur) {
      prog = s.oil.token ? 1 : 0;
      label = s.oil.token ? 'Ready' : '';
    }
    return `<li class="mstep${done ? ' done' : ''}${cur ? ' cur' : ''}"><b class="pix">${String(i + 1).padStart(2, '0')}</b><div><span>${esc(step.name)}</span><span class="thin"><i style="width:${(prog * 100).toFixed(0)}%"></i></span></div><em class="num">${label}</em></li>`;
  }).join('');
  const step = currentOilStep(s);
  const reason = oilBlockReason(s);
  const r = step?.reward;
  const reward = r
    ? [r.rep && `+${fmt(r.rep)} Authority rep`, r.credits && `+${fmt(r.credits)} cr`, r.xp && `+${fmt(r.xp.amount)} ${r.xp.skill} XP`, r.kit && KITS.find((k) => k.id === r.kit)?.name, r.hangar && 'Hangar opens', r.token && 'Depot token', r.oilDepot && 'Oil depot + oil depot kit']
        .filter(Boolean)
        .join(' · ')
    : '';
  const need = step?.deliver
    ? Object.entries(step.deliver)
        .map(([id, n]) => `<span class="${countItem(s.inventory, id) >= n ? '' : 'short'}">${fmt(Math.min(countItem(s.inventory, id), n))} / ${fmt(n)} ${esc(getItem(id).name)}</span>`)
        .join('<br>')
    : step?.salesValue
      ? `${fmt(s.oil.sales)} / ${fmt(step.salesValue)} CR`
      : 'Depot token';
  const card = step
    ? `<aside class="panel stepcard"><small class="kicker">Step ${String(s.oil.step + 1).padStart(2, '0')} of ${String(OIL_CHAIN.length).padStart(2, '0')}</small>
        <h3 class="pix">${esc(step.name)}</h3><p>${esc(step.text)}</p>
        <div class="stat"><small>Progress</small><b class="num cyan-t">${need}</b></div>
        <small class="kicker">Reward</small><p class="amber-t">${esc(reward)}</p>
        <button class="btn amber wide" data-act="oil" ${reason ? 'disabled' : ''}>${reason ? esc(reason) : 'Turn in'}</button></aside>`
    : `<aside class="panel stepcard"><h3 class="pix">Oil depot open</h3><p>The oil fields are yours. Extracting oil and refining fuel arrive with the ship build.</p></aside>`;
  return `<div class="row-h"><h2>Mission · Open the oil depot</h2><span class="num cyan-t">${Math.min(s.oil.step, OIL_CHAIN.length)} of ${OIL_CHAIN.length} steps done</span></div>
    <div class="missiongrid"><ol class="msteps">${rows}</ol>${card}</div>`;
}

function tasksTab(s: GameState, now: number): string {
  const board = boardFor(s, s.colony, now);
  const offers = board.offers
    .map((o, i) => {
      const n = countItem(s.inventory, o.item);
      return `<article class="card${o.done ? ' on' : ''}">${itemHead(o.item, `${getItem(o.item).kind === 'ore' ? 'Mining' : 'Refinery'} contract`)}
        <p class="num">${fmt(Math.min(n, o.amount))} / ${fmt(o.amount)} ${esc(getItem(o.item).name)}</p>
        <p class="dim">Pays ${fmt(o.credits)} cr · +${fmt(o.rep)} rep</p>
        <button class="btn${o.done ? ' ghost' : ' amber'}" data-act="contract" data-i="${i}" ${o.done || n < o.amount ? 'disabled' : ''}>${o.done ? 'Delivered' : 'Deliver'}</button></article>`;
    })
    .join('');
  const left = msToNextBoard(now);
  return `<p class="note">New contracts in ${Math.floor(left / 3_600_000)}h ${Math.floor((left % 3_600_000) / 60_000)}m. Contracts pay 130% of value plus 80% as reputation here. Only goods you made count.</p>
    <div class="cards">${offers || '<p class="note">Nothing you can fill here yet. Level Mining or Refining.</p>'}</div>`;
}

function presentTab(s: GameState): string {
  return `<p class="note">Present goods to the ${esc(colonyLabel(s.colony))} government: 80% of their value becomes standing here, and you get 20% back in credits. Higher standing lowers this colony's mining fee. The worst-quality units go first.</p>${cashOutTable(s, 'donate')}`;
}

export function cityScreen(s: GameState, now: number): string {
  const r = rankForRep(s.rep[s.colony]);
  const tab = ui.cityTab;
  const body = tab === 'mission' ? missionTab(s) : tab === 'tasks' ? tasksTab(s, now) : presentTab(s);
  return `${banner(`${colonyLabel(s.colony)} // City Center`, 'City Center', ['Gov. standing', `Rank ${r}`])}
    <div class="scene-box">${cityCenterScene()}</div>
    ${tabs('city-tab', tab, [
      ['tasks', 'Task board'],
      ['mission', 'Mission desk'],
      ['present', 'Present ore'],
    ])}
    ${body}`;
}

// ---------- Inventory ----------

export function inventoryScreen(s: GameState): string {
  const groups: [string, string[]][] = [
    ['Ores', []],
    ['Bars', []],
    ['Gems', []],
    ['Ship parts', []],
    ['Jewelry', []],
  ];
  const idx = { ore: 0, bar: 1, gem: 2, part: 3, jewelry: 4 } as const;
  for (const id of Object.keys(s.inventory)) groups[idx[getItem(id).kind]]![1].push(id);
  let total = 0;
  const body = groups
    .map(([title, ids]) => {
      const rows = ids
        .map((id) => {
          const stacks = s.inventory[id]!;
          const value = Object.entries(stacks).reduce((a, [q, n]) => a + unitValue(id, Number(q)) * n, 0);
          total += value;
          const open = ui.openItem === id;
          const detail = open
            ? `<ul class="stacks">${qualitiesOf(s.inventory, id, 'highest')
                .map((q) => `<li><span>Quality ${q} · ${qualityTier(q).name}</span><b class="num">×${fmt(stacks[q]!)}</b></li>`)
                .join('')}</ul>`
            : '';
          return `<li><button class="inv-row" data-act="open-item" data-item="${id}" aria-expanded="${open}">${iconBox(id)}<span>${esc(getItem(id).name)}<small>${qualityLabel(stacks)} · ${fmt(value)} cr</small></span><b class="num">${fmt(countItem(s.inventory, id))}</b></button>${detail}</li>`;
        })
        .join('');
      return `<section class="inv"><h2>${title}</h2>${rows ? `<ul>${rows}</ul>` : '<p class="note">None yet.</p>'}</section>`;
    })
    .join('');
  const kits = KITS.filter((k) => s.kits.includes(k.id))
    .map((k) => `${esc(k.name)}${k.id === equippedKit(s).id ? ' (equipped)' : ''}`)
    .join(', ');
  return `${banner('Cargo // Storage', 'Inventory', ['Hold value', `${fmt(total)} CR`])}
    <p class="note">Tap an item to see its quality stacks. Kits: ${kits}.</p>
    <div class="invgrid">${body}</div>`;
}

// ---------- Hangar (mood board "Hangar"; building arrives in S7) ----------

const SHIP_PARTS: [string, string][] = [
  ['Hull', 'Standard Hauler'],
  ['Nose', 'Needle'],
  ['Cockpit', 'Bubble Canopy'],
  ['Wings', 'Delta'],
  ['Engines', 'Twin Burners'],
  ['Mining rig', 'Drill Pods'],
  ['Paint', 'Factory Grey'],
  ['Lights', 'Dark Running'],
];

export function hangarScreen(s: GameState): string {
  const open = s.oil.hangar;
  return `${banner(`Deepcore Colony // Bay 02`, open ? 'Starter hauler' : 'Hangar', undefined)}
    <div class="tabs"><span class="tab on">Exterior</span><span class="tab dis">Interior · later</span></div>
    <div class="scene-box">${hangarScene(open)}</div>
    ${
      open
        ? `<div class="partslots">${SHIP_PARTS.map(([slot, name], i) => `<div class="partslot${i === 0 ? ' on' : ''}"><small>${slot}</small><span>${name}</span></div>`).join('')}</div>
           <p class="note">Your starter hauler sits on the pad. Building and fitting parts, which affect your ship's performance and launch odds, arrives in a coming update.</p>`
        : `<p class="note">The Authority opens a hangar bay to you after <b>oil depot step 2: Bronze for the scaffold</b> (City Center → Mission desk).</p>`
    }`;
}
