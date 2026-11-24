import { esc } from '../format';
import { backupInfo, store } from '../store';
import { ui } from '../uiState';
import { banner } from './common';

// Settings: saves (export, import, backup), preferences and reset.

const when = (t: number): string => (t ? new Date(t).toLocaleString() : 'never');

export function settingsScreen(): string {
  const b = backupInfo();
  const st = store.settings;
  return `${banner('Operations // Terminal', 'Settings')}
    <section class="panel setting">
      <div class="panel-h"><span>Your save</span></div>
      <p>The game saves in this browser every second. Last saved: <b>${esc(when(store.lastSaved))}</b>.</p>
      <h3 class="kicker amber-k">Export</h3>
      <p class="dim">Copy this code to keep a backup or move your game to another device or browser.</p>
      ${ui.exportText ? `<textarea class="code" readonly rows="4" aria-label="Export code">${esc(ui.exportText)}</textarea>
        <div class="acts"><button class="btn amber sm" data-act="export-copy">Copy code</button><button class="btn ghost sm" data-act="export-file">Download as file</button></div>`
        : `<button class="btn amber sm" data-act="export-show">Show export code</button>`}
      <h3 class="kicker amber-k">Import</h3>
      <p class="dim">Paste a code that starts with <b>DEEPCORE:</b>. It replaces the game in this browser; your current game goes to the backup slot first.</p>
      <textarea class="code" rows="3" data-act="import-text" aria-label="Paste an export code" placeholder="DEEPCORE:…">${esc(ui.importText)}</textarea>
      <button class="btn ghost sm" data-act="import">Load this save</button>
      <h3 class="kicker amber-k">Backup</h3>
      <p class="dim">An automatic copy, refreshed every 30 minutes and before any import or reset. ${b ? `Current backup: <b>${esc(when(b.savedAt))}</b>.` : 'No backup yet.'}</p>
      ${b ? '<button class="btn ghost sm" data-act="restore">Restore backup</button>' : ''}
    </section>
    <section class="panel setting">
      <div class="panel-h"><span>Preferences</span></div>
      <label class="toggle"><input type="checkbox" data-act="set-tips" ${st.tips ? 'checked' : ''}> Show next-goal tips</label>
      <label class="toggle"><input type="checkbox" data-act="set-sound" ${st.sound ? 'checked' : ''}> Level-up sounds</label>
    </section>
    <section class="panel setting danger">
      <div class="panel-h"><span>Start over</span></div>
      <p class="dim">Wipes this game. Your current game goes to the backup slot first, so you can undo it once.</p>
      <button class="btn ghost sm" data-act="reset">${ui.resetArmed ? 'Tap again to wipe everything' : 'Reset game'}</button>
    </section>`;
}
