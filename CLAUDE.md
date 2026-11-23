# Deepcore — notes for coding sessions

Browser idle game (mine → refine → craft → sell/donate → build a ship → launch).

## Read first, every session
1. `docs/PLAN.md` — release plan, session list (S1–S8) and the **decisions log**. Where it disagrees with the GDD, the decisions log wins.
2. `docs/GDD.md` — rules and data tables (source of truth for numbers).

At the end of a session: tick its checkbox in `docs/PLAN.md`, note anything deferred, commit and push.

## Commands
- `npm run dev` — local dev server
- `npm test` — Vitest unit tests (must pass before committing)
- `npm run typecheck` — TypeScript strict check
- `npm run build` — typecheck + production build to `dist/`

CI (`.github/workflows/ci.yml`) runs typecheck, tests and build on every push, and deploys `dist/` to GitHub Pages from `main`.

## Layout
- `src/data/` — data tables copied from the GDD (ores, bars, recipes, kits, colonies, oil chain). Change numbers here and in the GDD together.
- `src/engine/` — game rules. Keep it pure and deterministic: no DOM, no `Date.now()` or `Math.random()` inside; take a clock and RNG as arguments so tests and the balance sim can drive it. Every rule gets a unit test next to it (`*.test.ts`).
- `src/ui/` — screens (from S4). UI reads engine state; it never computes rules itself.
- `tools/pacing_sim.py` — the planning-session pacing sim; replaced by a TypeScript sim on the real engine in S3.

## Rules of thumb
- Items always carry a quality 1–100; inventory stacks by item + quality (`src/engine/inventory.ts`).
- Item ids are camelCase and stable — saves depend on them. Renaming one needs a save migration.
- No market buying in v0.1 (decision D3). Ships and modules can't be bought with credits (D6).
- Dev-only controls (speed, fast-forward) must never ship in the player UI or affect offline time.
