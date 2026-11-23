// Temporary page for S1: proves the build, data tables and engine wire up.
// The real game screens arrive in S4 (docs/PLAN.md).
import { BARS, CRAFTABLES, ORES } from './data/items';
import { COLONIES } from './data/world';
import { feeAtRank } from './engine/reputation';
import { xpForLevel } from './engine/xp';

const fmt = (n: number) => n.toLocaleString('en-US');
const pct = (f: number) => `${Math.round(f * 100)}%`;

const table = (head: string[], rows: (string | number)[][]) =>
  `<div class="scroll"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => (typeof c === 'number' ? `<td class="n">${fmt(c)}</td>` : `<td>${c}</td>`)).join('')}</tr>`)
    .join('')}</tbody></table></div>`;

document.querySelector<HTMLElement>('#app')!.innerHTML = `
  <h1>Deepcore</h1>
  <p>Engine scaffold (session S1). The playable game arrives in later sessions.</p>
  <h2>Colonies</h2>
  ${table(['Colony', 'Fee at rank 0', 'Rank 5', 'Rank 10'], COLONIES.map((c) => [c.name, pct(c.startingFee), pct(feeAtRank(c.startingFee, 5)), pct(feeAtRank(c.startingFee, 10))]))}
  <h2>Ores</h2>
  ${table(['Ore', 'Mining level', 'XP', 'Value'], ORES.map((o) => [o.name, o.miningLevel, o.xp, o.value]))}
  <h2>Bars</h2>
  ${table(['Bar', 'Refining level', 'XP', 'Value'], BARS.map((b) => [b.name, b.refiningLevel, b.xp, b.value]))}
  <h2>Crafting</h2>
  ${table(['Item', 'Crafting level', 'XP', 'Value'], CRAFTABLES.map((c) => [c.name, c.craftingLevel, c.xp, c.value]))}
  <h2>XP curve (×12)</h2>
  ${table(['Level', 'Total XP'], [10, 30, 50, 65, 75, 99].map((l) => [l, xpForLevel(l)]))}
`;
