import type { ColonyId } from '../data/types';
import { getItem } from '../data/items';
import { actionTimeMs, enqueue, npcRefineAll, removeStep, startAction, stopAll } from '../engine/actions';
import { deliverContract, turnInOilStep } from '../engine/contracts';
import { countItem } from '../engine/inventory';
import { buyKit, donate, sellToBroker } from '../engine/market';
import { listWare, moveWare, setWarePrice, unlistWare } from '../engine/stall';
import type { ActionKind } from '../engine/state';
import { duration, esc, fmt } from './format';
import { nextGoal } from './goals';
import { addLog, applyAway, exportCode, importCode, load, resetGame, restoreBackup, save, store, tick } from './store';
import { ui, type CityTab, type MapSite, type Route, type TradeTab } from './uiState';
import { coachCard, header, rightColumn, sidebar } from './views/common';
import { returnScreen } from './views/returnScreen';
import { settingsScreen } from './views/settings';
import {
  cityScreen,
  craftingScreen,
  hangarScreen,
  inventoryScreen,
  mapScreen,
  miningScreen,
  refiningScreen,
  stallScreen,
} from './views/screens';

// Shell, routing, input handling and the real-time loop.

const ROUTES: Record<Route, () => string> = {
  map: () => mapScreen(store.state),
  mining: () => miningScreen(store.state),
  refining: () => refiningScreen(store.state),
  crafting: () => craftingScreen(store.state),
  stall: () => stallScreen(store.state),
  city: () => cityScreen(store.state, Date.now()),
  inventory: () => inventoryScreen(store.state),
  hangar: () => hangarScreen(store.state),
  settings: () => settingsScreen(),
};

let root: HTMLElement;
let interacting = false;

function noticeBar(): string {
  return store.notice ? `<div class="away"><span>${esc(store.notice)}</span><button class="btn sm ghost" data-act="dismiss-notice">OK</button></div>` : '';
}

function coach(): string {
  if (!store.settings.tips || ui.route === 'settings') return '';
  return coachCard(nextGoal(store.state));
}

function devPanel(): string {
  if (!ui.dev) return '';
  return `<div class="dev"><b>Dev tools</b>
    <button class="btn ghost sm" data-act="dev-ff" data-h="1">+1 h</button>
    <button class="btn ghost sm" data-act="dev-ff" data-h="12">+12 h</button>
    <button class="btn ghost sm" data-act="dev-slots">Queue slots +1</button>
    <button class="btn ghost sm" data-act="dev-cash">+10k credits</button>
    <button class="btn ghost sm" data-act="dev-away" data-h="8">Pretend away 8 h</button>
    <button class="btn ghost sm" data-act="dev-reset">Reset save</button></div>`;
}

export function render(): void {
  const s = store.state;
  const main = ROUTES[ui.route]();
  root.innerHTML = `${header(s)}
    <div class="body">
      ${sidebar(s)}
      <main class="main${ui.route === 'map' ? ' full' : ''}">${noticeBar()}${devPanel()}<div class="screen">${coach()}${main}</div>${ui.route === 'map' ? '' : rightColumn(s)}</main>
    </div>
    <div class="toast${ui.toast ? ' show' : ''}" role="status">${esc(ui.toast)}</div>`;
}

let toastTimer = 0;
function toast(text: string): void {
  ui.toast = text;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    ui.toast = '';
    render();
  }, 2600);
}

/** Cheap per-frame updates that don't rebuild the page. */
function updateLive(): void {
  const s = store.state;
  const cur = s.queue[0];
  const bar = root.querySelector<HTMLElement>('[data-live="progress"] i');
  if (bar && cur) {
    const t = actionTimeMsSafe();
    bar.style.width = `${Math.min(100, (s.progressMs / t) * 100).toFixed(1)}%`;
  }
  const cr = root.querySelector<HTMLElement>('[data-live="credits"]');
  if (cr) cr.textContent = `${fmt(s.credits)} CR`;
  const tl = root.querySelector<HTMLElement>('[data-live="timeleft"]');
  if (tl && cur?.durationMs != null) tl.textContent = duration(cur.durationMs - cur.elapsedMs);
}

const actionTimeMsSafe = (): number => (store.state.queue[0] ? actionTimeMs(store.state, store.state.queue[0]) : 1);

// ---------- Return screen overlay ----------
// Lives outside the re-rendered shell so its animation plays once.

let rsEl: HTMLElement | null = null;
let rsTimers: number[] = [];
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function beep(): void {
  if (!store.settings.sound) return;
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(523, ctx.currentTime);
    o.frequency.setValueAtTime(784, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio can be unavailable or blocked until the player taps; the burst still shows.
  }
}

const delayOf = (el: Element): number => parseFloat((el.closest('[style*="--d"]') as HTMLElement | null)?.style.getPropertyValue('--d') ?? '0') || 0;

function setCount(el: HTMLElement, v: number): void {
  el.textContent = `${el.dataset.sign ?? ''}${fmt(v)}`;
}

function showReturnScreen(): void {
  if (!store.away || rsEl) return;
  rsEl = document.createElement('div');
  rsEl.innerHTML = returnScreen(store.state, store.away, Date.now());
  document.body.appendChild(rsEl);
  document.body.classList.add('rs-open');
  const counts = [...rsEl.querySelectorAll<HTMLElement>('[data-count]')];
  if (reduceMotion()) return skipReturnScreen();
  const t0 = performance.now();
  const tickCounts = (t: number) => {
    let running = false;
    for (const el of counts) {
      const target = Number(el.dataset.count);
      const start = delayOf(el) * 1000;
      const p = Math.max(0, Math.min(1, (t - t0 - start) / 900));
      setCount(el, Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) running = true;
    }
    if (running && rsEl && !rsEl.querySelector('.rs.skip')) requestAnimationFrame(tickCounts);
  };
  requestAnimationFrame(tickCounts);
  for (const el of rsEl.querySelectorAll('[data-levelup]')) rsTimers.push(window.setTimeout(beep, (delayOf(el) + 0.5) * 1000));
}

function skipReturnScreen(): void {
  if (!rsEl) return;
  rsEl.querySelector('.rs')?.classList.add('skip');
  for (const el of rsEl.querySelectorAll<HTMLElement>('[data-count]')) setCount(el, Number(el.dataset.count));
  rsTimers.forEach(clearTimeout);
  rsTimers = [];
}

function closeReturnScreen(): void {
  rsTimers.forEach(clearTimeout);
  rsTimers = [];
  rsEl?.remove();
  rsEl = null;
  store.away = null;
  document.body.classList.remove('rs-open');
}

function stepInput(kind: ActionKind, target: string) {
  return { kind, target, durationMs: ui.queueHours > 0 ? ui.queueHours * 3_600_000 : null };
}

function onClick(e: MouseEvent): void {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
  const s = store.state;
  const d = el.dataset;
  const item = d.item ?? '';
  switch (d.act) {
    case 'route':
      ui.route = d.to as Route;
      window.scrollTo(0, 0);
      break;
    case 'enter':
      s.colony = d.colony as ColonyId;
      ui.mapSite = null;
      ui.route = 'mining';
      break;
    case 'site':
      ui.mapSite = d.site as MapSite;
      break;
    case 'back-to-work': {
      // Return to the screen for whatever is running, in the colony it runs in.
      const cur = s.queue[0];
      if (cur) s.colony = cur.colony;
      ui.mapSite = null;
      ui.route = cur ? ({ mine: 'mining', refine: 'refining', craft: 'crafting', sell: 'stall' } as const)[cur.kind] : 'mining';
      break;
    }
    case 'city-tab':
      ui.cityTab = d.tab as CityTab;
      break;
    case 'trade-tab':
      ui.tradeTab = d.tab as TradeTab;
      break;
    case 'stall-pick':
      ui.stallItem = item;
      break;
    case 'start':
      startAction(s, { kind: d.kind as ActionKind, target: d.target! });
      break;
    case 'enqueue': {
      const problem = enqueue(s, stepInput(d.kind as ActionKind, d.target!));
      if (problem) toast(problem);
      break;
    }
    case 'unqueue':
      removeStep(s, Number(d.i));
      break;
    case 'stopall':
      stopAll(s);
      break;
    case 'npc': {
      const got = npcRefineAll(s, d.target!);
      toast(got ? `The NPC refiner handed you ${fmt(got)} ${getItem(d.target!).name}s` : 'Not enough materials');
      if (got) addLog(`NPC refiner made ${fmt(got)} ${getItem(d.target!).name}s`);
      break;
    }
    case 'list':
      if (!listWare(s, item)) toast('All 6 stall slots are full');
      break;
    case 'unlist':
      unlistWare(s, item);
      break;
    case 'ware-up':
      moveWare(s, item, -1);
      break;
    case 'ware-down':
      moveWare(s, item, 1);
      break;
    case 'ware-reset':
      setWarePrice(s, item, 1);
      break;
    case 'amt-all':
      ui.amounts[item] = countItem(s.inventory, item);
      break;
    case 'donate':
    case 'broker': {
      const n = Math.min(countItem(s.inventory, item), Math.max(1, Math.floor(ui.amounts[item] ?? countItem(s.inventory, item))));
      const out = d.act === 'donate' ? donate(s, item, n) : sellToBroker(s, item, n);
      if (out) {
        const text = `${d.act === 'donate' ? 'Donated' : 'Brokered'} ${fmt(n)} ${getItem(item).name}: +${fmt(out.credits)} cr, +${fmt(out.rep)} rep`;
        toast(text);
        addLog(text, 'good');
      }
      delete ui.amounts[item];
      break;
    }
    case 'buykit': {
      const r = buyKit(s, d.kit!);
      toast(r.ok ? 'Kit bought and equipped when usable' : r.reason);
      break;
    }
    case 'oil': {
      const r = turnInOilStep(s);
      if (r.ok) addLog('Oil depot contract: step complete', 'good');
      toast(r.ok ? 'Contract step complete!' : r.reason);
      break;
    }
    case 'contract': {
      const r = deliverContract(s, s.colony, Number(d.i), Date.now());
      toast(r.ok ? 'Contract delivered' : r.reason);
      if (r.ok) addLog('Contract delivered', 'good');
      break;
    }
    case 'open-item':
      ui.openItem = ui.openItem === item ? null : item;
      break;
    case 'dismiss-notice':
      store.notice = '';
      break;
    case 'goal': {
      const g = nextGoal(s);
      ui.route = g.route;
      if (g.cityTab) ui.cityTab = g.cityTab;
      break;
    }
    case 'hide-tips':
      store.settings.tips = false;
      toast('Tips hidden. Turn them back on in Settings.');
      break;
    // ----- Return screen -----
    case 'rs-skip':
      skipReturnScreen();
      return;
    case 'rs-collect':
    case 'rs-goal':
    case 'rs-change': {
      closeReturnScreen();
      if (d.act === 'rs-goal') {
        const g = nextGoal(s);
        ui.route = g.route;
        if (g.cityTab) ui.cityTab = g.cityTab;
      } else if (d.act === 'rs-change') ui.route = 'map';
      break;
    }
    // ----- Settings -----
    case 'export-show':
      ui.exportText = exportCode();
      break;
    case 'export-copy':
      navigator.clipboard?.writeText(ui.exportText).then(
        () => toast('Export code copied'),
        () => toast('Copy failed: select the code and copy it by hand'),
      );
      return;
    case 'export-file': {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([ui.exportText], { type: 'text/plain' }));
      a.download = `deepcore-save-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }
    case 'import': {
      if (!ui.importText.trim()) return toast('Paste an export code first');
      if (!confirm('Replace the game in this browser with the pasted save? Your current game goes to the backup slot.')) return;
      const err = importCode(ui.importText);
      toast(err ?? 'Save loaded');
      if (!err) ui.importText = '';
      ui.exportText = '';
      break;
    }
    case 'restore': {
      if (!confirm('Load the backup? Your current progress since then will be replaced.')) return;
      const err = restoreBackup();
      toast(err ?? 'Backup restored');
      ui.exportText = '';
      break;
    }
    case 'reset':
      if (!ui.resetArmed) {
        ui.resetArmed = true;
        break;
      }
      ui.resetArmed = false;
      resetGame();
      ui.route = 'map';
      toast('New game started. The old one is in the backup slot.');
      break;
    case 'dev-ff':
      tick(Number(d.h) * 3_600_000);
      break;
    case 'dev-slots':
      s.queueSlots = Math.min(3, s.queueSlots + 1);
      break;
    case 'dev-cash':
      s.credits += 10_000;
      break;
    case 'dev-reset':
      if (confirm('Wipe this save?')) resetGame();
      break;
    case 'dev-away':
      applyAway(Number(d.h) * 3_600_000);
      showReturnScreen();
      break;
    default:
      return;
  }
  save();
  render();
}

function onInput(e: Event): void {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  const d = el.dataset;
  if (d.act === 'price') {
    setWarePrice(store.state, d.item!, Number(el.value) / 100);
    // Update the numbers next to the slider without rebuilding (keeps the drag alive).
    // Re-render when the drag ends ('change'), not on every move, so the slider stays grabbed.
    if (e.type === 'change') render();
    save();
  } else if (d.act === 'amount') {
    ui.amounts[d.item!] = Number(el.value);
  } else if (d.act === 'qhours') {
    ui.queueHours = Number(el.value);
  } else if (d.act === 'import-text') {
    ui.importText = el.value;
  } else if (d.act === 'set-tips' || d.act === 'set-sound') {
    store.settings[d.act === 'set-tips' ? 'tips' : 'sound'] = (el as HTMLInputElement).checked;
    save();
  }
}

export function start(container: HTMLElement): void {
  root = container;
  const params = new URLSearchParams(location.search);
  ui.dev = import.meta.env.DEV || params.get('dev') === '1';
  load();
  render();
  showReturnScreen();
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onInput);
  root.addEventListener('pointerdown', () => (interacting = true));
  window.addEventListener('pointerup', () => setTimeout(() => (interacting = false), 100));
  window.addEventListener('beforeunload', () => save());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
  });

  let last = Date.now();
  let sinceRender = 0;
  const loop = () => {
    // Wall-clock time, so a background tab catches up when it wakes. Gaps over
    // a minute count as time away, with the offline cap.
    const now = Date.now();
    const dt = Math.max(0, now - last);
    last = now;
    let notable: boolean;
    if (dt > 60_000) {
      applyAway(dt);
      showReturnScreen();
      notable = true;
    } else notable = tick(dt);
    sinceRender += dt;
    const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLSelectElement || document.activeElement instanceof HTMLTextAreaElement;
    if ((notable || sinceRender > 1000) && !interacting && !typing) {
      sinceRender = 0;
      render();
      save();
    } else updateLive();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
