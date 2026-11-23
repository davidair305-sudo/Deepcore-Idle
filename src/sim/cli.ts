// Pacing report: `npm run sim` (optionally `npm run sim -- 21` for days).
declare const process: { argv: string[] };
import { runSim } from './run';

const days = Number(process.argv[2] ?? 21);
const m = runSim(days);
const d = (x: number | undefined) => (x == null ? '—' : `day ${x.toFixed(1)}`);

console.log(`Twice-a-day bot, ${days} days\n`);
console.log('Oil depot chain:');
m.oilSteps.forEach((x, i) => console.log(`  step ${i + 1}: ${d(x)}`));
console.log('\nHome rank reached:');
m.homeRanks.forEach((x, r) => r > 0 && console.log(`  rank ${r}: ${d(x)}`));
console.log('\nDay | Mining Refining Crafting Trading | Home rank | Credits');
for (const r of m.daily)
  console.log(
    `${String(r.day).padStart(3)} | ${String(r.mining).padStart(6)} ${String(r.refining).padStart(8)} ${String(r.crafting).padStart(8)} ${String(r.trading).padStart(7)} | ${String(r.homeRank).padStart(9)} | ${r.credits.toLocaleString('en-US')}`,
  );
