import { CRAFTABLES, getItem } from '../../data/items';
import { COLONIES, KITS, KIT_TRADER_RANK, OIL_CHAIN, getColony } from '../../data/world';
import {
  MINE_TIME_MS,
  actionTimeMs,
  blockReason,
  equippedKit,
  getBar,
  getOre,
  keptOrePerAction,
  level,
} from '../../engine/actions';
import { boardFor, currentOilStep, msToNextBoard, oilBlockReason } from '../../engine/contracts';
import { countItem, qualitiesOf } from '../../engine/inventory';
import { qualityTier } from '../../engine/quality';
import { colonyFee, rankForRep } from '../../engine/reputation';
import { currentWare, normalSpeedPrice, saleSpeed, saleTimeMs } from '../../engine/stall';
import type { ActionKind, GameState, QueueStep } from '../../engine/state';
import { marketValue, unitValue } from '../../engine/value';
import { esc, fmt, money, pct } from '../format';
import { itemIcon } from '../icons';
import { ui } from '../uiState';
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

// ---------- Belt map ----------

export function mapScreen(s: GameState): string {
  const pos = [
    [20, 62],
    [50, 30],
    [80, 64],
  ];
  const nodes = COLONIES.map((c, i) => {
    const r = rankForRep(s.rep[c.id]);
    const working = s.queue[0]?.colony === c.id;
    return `<button class="node${c.id === s.colony ? ' here' : ''}" style="left:${pos[i]![0]}%;top:${pos[i]![1]}%" data-act="enter" data-colony="${c.id}">
      <span class="rock" aria-hidden="true"></span>
      <b>${esc(c.shortName === 'Authority' ? 'Deepcore Colony' : c.name)}</b>
      <small class="num">Rank ${r}/10 · fee ${pct(colonyFee(c.id, s.rep[c.id]))}</small>
      ${working ? '<small class="work">Working here</small>' : ''}
    </button>`;
  }).join('');
  return `${banner('Sector 9 // Outer belt', 'Mining belt')}
    <div class="map"><svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path d="M20 38 L50 19 L80 40" fill="none" stroke="#4FD1E8" stroke-width=".3" stroke-dasharray="1.2 1" opacity=".6"/></svg>${nodes}</div>
    <div class="cards two">${COLONIES.map(
      (c) => `<button class="card pick" data-act="enter" data-colony="${c.id}"><h3>${esc(c.name)}</h3>
        <p>${c.ores.map((o) => getItem(o).name).join(', ')}</p><p class="dim">${esc(c.note)}</p></button>`,
    ).join('')}</div>`;
}

// ---------- Mining ----------

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
  return `${banner(`${c.shortName} // Deep shaft`, 'Mining', ['Colony fee', pct(colonyFee(s.colony, s.rep[s.colony]))])}
    <p class="note">Kit: <b>${esc(equippedKit(s).name)}</b> ×${equippedKit(s).yieldMultiplier} · The colony takes its fee from your ore, never your XP. Higher Mining level means better ore quality.</p>
    <div class="cards">${cards}</div>`;
}

// ---------- Refining ----------

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
  return `${banner(`${c.shortName} // Smelter`, 'Refinery')}
    <p class="note">Bars keep 70% of their ore's quality at the level requirement, rising to 100% with skill. The NPC refiner is instant but keeps 40% of the bars, pours worse bars and gives no XP.</p>
    <div class="cards">${cards}</div>`;
}

// ---------- Crafting ----------

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
  return `${banner('Workshop // Fabrication bay', 'Crafting')}
    <p class="note">Each craft rolls botched, standard, fine or masterwork. Higher Crafting means fewer botches; a perfect craft (quality 100) needs top materials and a masterwork roll.</p>
    <h2>Starship parts</h2><div class="cards">${CRAFTABLES.filter((c) => c.kind === 'part').map((c) => card(c.id)).join('')}</div>
    <h2>Gems and jewelry</h2><div class="cards">${CRAFTABLES.filter((c) => c.kind === 'jewelry').map((c) => card(c.id)).join('')}</div>`;
}

// ---------- Stall ----------

export function stallScreen(s: GameState): string {
  const tl = level(s, 'trading');
  const cur = currentWare(s);
  const est = cur ? perHour(saleTimeMs(s)) * marketValue(s.colony, cur.item, qualitiesOf(s.inventory, cur.item, cur.pick)[0] ?? 1) * cur.price : 0;
  const oilStep = currentOilStep(s);
  const oilSales = oilStep?.salesValue
    ? `<div class="stat wide"><small>Oil depot mission · stall token</small><b class="num">${fmt(s.oil.sales)} / ${fmt(oilStep.salesValue)} CR sold</b><span class="thin"><i style="width:${Math.min(100, (s.oil.sales / oilStep.salesValue) * 100)}%"></i></span></div>`
    : '';
  const wares = s.stall
    .map((w, i) => {
      const n = countItem(s.inventory, w.item);
      const q = qualitiesOf(s.inventory, w.item, w.pick)[0] ?? 1;
      const each = marketValue(s.colony, w.item, q) * w.price;
      const speed = saleSpeed(w.price, tl);
      return `<li class="ware${n ? '' : ' empty'}">
        ${iconBox(w.item)}
        <div class="ware-main">
          <div class="ware-h"><b>${i + 1}. ${esc(getItem(w.item).name)}</b><span class="num">×${fmt(n)} ${qualityLabel(s.inventory[w.item])}</span></div>
          <label class="slider"><span class="sr">Price for ${esc(getItem(w.item).name)}</span>
            <input type="range" min="25" max="300" step="5" value="${Math.round(w.price * 100)}" data-act="price" data-item="${w.item}">
          </label>
          <div class="chips"><span>Price <b>${Math.round(w.price * 100)}%</b> of market</span><span><b>${money(each)} cr</b> each</span><span>Speed <b>${speed.toFixed(2)}×</b></span></div>
        </div>
        <div class="ware-btns">
          <button class="btn ghost sm" data-act="ware-up" data-item="${w.item}" aria-label="Sell earlier">▲</button>
          <button class="btn ghost sm" data-act="ware-down" data-item="${w.item}" aria-label="Sell later">▼</button>
          <button class="btn ghost sm" data-act="ware-reset" data-item="${w.item}">Market</button>
          <button class="btn ghost sm" data-act="unlist" data-item="${w.item}">Remove</button>
        </div>
      </li>`;
    })
    .join('');
  const addable = Object.keys(s.inventory).filter((id) => !s.stall.some((w) => w.item === id));
  return `${banner(`${getColony(s.colony).shortName} // Trade ring`, 'Your stall', ['Normal-speed price', pct(normalSpeedPrice(tl))])}
    <div class="stats">
      ${actionButtons(s, 'sell', 'stall', s.stall.length && cur ? null : 'Add wares to open')}
      <div class="stat"><small>Est. sales</small><b class="num">${fmt(est)} CR/H</b></div>
      ${oilSales}
    </div>
    <p class="note">Wares sell one unit at a time, top of the list first. The slider starts at market price: higher sells slower, lower sells faster. Each sale also earns reputation worth 20% of the item's value, whatever your price.</p>
    <ol class="wares">${wares || '<li class="note">No wares yet. Add something below.</li>'}</ol>
    <h2>Add wares</h2>
    <div class="chipbtns">${addable.length ? addable.map((id) => `<button class="btn ghost sm" data-act="list" data-item="${id}">${itemIcon(id)} ${esc(getItem(id).name)} ×${fmt(countItem(s.inventory, id))}</button>`).join('') : '<p class="note">Nothing else to sell.</p>'}</div>`;
}

// ---------- Market: broker, donations, kit trader ----------

export function marketScreen(s: GameState): string {
  const c = getColony(s.colony);
  const ids = Object.keys(s.inventory);
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
          <button class="btn sm" data-act="donate" data-item="${id}">Donate</button>
          ${c.hasBroker ? `<button class="btn ghost sm" data-act="broker" data-item="${id}">Broker</button>` : ''}
        </div></td>
      </tr>`;
    })
    .join('');
  const rank = rankForRep(s.rep[s.colony]);
  const kits =
    rank >= KIT_TRADER_RANK
      ? `<div class="cards">${KITS.filter((k) => k.price > 0)
          .map((k) => {
            const own = s.kits.includes(k.id);
            return `<article class="card${own ? ' on' : ''}"><h3>${esc(k.name)}</h3><p class="num">×${k.yieldMultiplier} yield · Mining ${k.miningLevel}</p><p class="dim">${fmt(k.price)} cr</p>
              <button class="btn ${own ? 'ghost' : 'amber'}" data-act="buykit" data-kit="${k.id}" ${own || s.credits < k.price ? 'disabled' : ''}>${own ? 'Owned' : 'Buy'}</button></article>`;
          })
          .join('')}</div>`
      : `<p class="note">The kit trader only deals with rank ${KIT_TRADER_RANK} miners in ${esc(c.shortName)}. You're rank ${rank}.</p>`;
  return `${banner(`${c.shortName} // Exchange`, 'Market')}
    <p class="note">Donate: 20% of value in credits and 80% as reputation here. ${c.hasBroker ? 'Broker: instant 60% in credits and 20% as Authority reputation. ' : ''}The worst-quality units go first.</p>
    ${ids.length ? `<div class="scroll"><table><thead><tr><th>Item</th><th>Qty</th><th>Quality</th><th>Value</th><th>Cash out</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="note">Your hold is empty.</p>'}
    <h2>Kit trader</h2>${kits}`;
}

// ---------- Task board ----------

export function boardScreen(s: GameState, now: number): string {
  const step = currentOilStep(s);
  const reason = oilBlockReason(s);
  const need = step?.deliver
    ? Object.entries(step.deliver)
        .map(([id, n]) => `<span class="${countItem(s.inventory, id) >= n ? '' : 'short'}">${fmt(Math.min(countItem(s.inventory, id), n))}/${fmt(n)} ${esc(getItem(id).name)}</span>`)
        .join(' · ')
    : step?.salesValue
      ? `${fmt(s.oil.sales)}/${fmt(step.salesValue)} cr sold at your stall`
      : step?.handInToken
        ? 'Depot token ready'
        : '';
  const r = step?.reward;
  const reward = r
    ? [r.rep && `+${fmt(r.rep)} Authority rep`, r.credits && `+${fmt(r.credits)} cr`, r.xp && `+${fmt(r.xp.amount)} ${r.xp.skill} XP`, r.kit && KITS.find((k) => k.id === r.kit)?.name, r.hangar && 'Hangar opens', r.token && 'Depot token', r.oilDepot && 'Oil depot + oil depot kit']
        .filter(Boolean)
        .join(' · ')
    : '';
  const chain = step
    ? `<article class="card story"><small>Story contract · Deepcore Colony Authority · step ${s.oil.step + 1}/${OIL_CHAIN.length}</small>
        <h3>${esc(step.name)}</h3><p>${esc(step.text)}</p><p class="num">${need}</p><p class="dim">Reward: ${esc(reward)}</p>
        <button class="btn amber" data-act="oil" ${reason ? 'disabled' : ''}>${reason ? esc(reason) : 'Turn in'}</button>
        <span class="thin"><i style="width:${(s.oil.step / OIL_CHAIN.length) * 100}%"></i></span></article>`
    : `<article class="card story"><h3>Oil depot open</h3><p>Oil extraction and fuel arrive with the ship build.</p></article>`;
  const board = boardFor(s, s.colony, now);
  const offers = board.offers
    .map((o, i) => {
      const n = countItem(s.inventory, o.item);
      return `<article class="card${o.done ? ' on' : ''}">${itemHead(o.item, `${getItem(o.item).kind === 'ore' ? 'Mining' : 'Refinery'} contract`)}
        <p class="num">${fmt(Math.min(n, o.amount))}/${fmt(o.amount)} ${esc(getItem(o.item).name)}</p>
        <p class="dim">Pays ${fmt(o.credits)} cr · +${fmt(o.rep)} rep</p>
        <button class="btn${o.done ? ' ghost' : ' amber'}" data-act="contract" data-i="${i}" ${o.done || n < o.amount ? 'disabled' : ''}>${o.done ? 'Delivered' : 'Deliver'}</button></article>`;
    })
    .join('');
  const left = msToNextBoard(now);
  return `${banner(`${getColony(s.colony).shortName} // Task board`, 'Task board')}
    ${s.colony === 'authority' ? chain : '<p class="note">The oil depot story contract is posted at Deepcore Colony.</p>'}
    <h2>Contracts here</h2><p class="note">New contracts in ${Math.floor(left / 3_600_000)}h ${Math.floor((left % 3_600_000) / 60_000)}m. They pay 130% of value plus 80% as reputation.</p>
    <div class="cards">${offers || '<p class="note">Nothing you can fill here yet. Level Mining or Refining.</p>'}</div>`;
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

// ---------- Hangar ----------

export function hangarScreen(s: GameState): string {
  return `${banner('Deepcore Colony // Bay 3', 'Hangar')}
    <article class="card story">${
      s.oil.hangar
        ? `<h3>Hangar bay open</h3><p>Your ship is a bare frame on the pad. Building modules (the Shift Scheduler first, then the launch modules) arrives in a coming update.</p>`
        : `<h3>Hangar locked</h3><p>The Authority opens a hangar bay to you after <b>oil depot step 2: Bronze for the scaffold</b>.</p>`
    }</article>`;
}
