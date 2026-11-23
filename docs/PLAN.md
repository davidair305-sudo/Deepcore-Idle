# Deepcore — Release Plan (v0.1 "The Colony")

Written 2026-11-23 in a planning session. Read this together with `docs/GDD.md` (the rules source of truth) at the start of every work session. Where this plan and the GDD disagree, **this plan's decisions log wins** until the GDD is updated. Update the checkboxes as sessions finish.

Sources reviewed: the GDD, the v9 playable prototype (single HTML artifact), the mood board, and a pacing simulation (`tools/pacing_sim.py`).

---

## 1. Review findings

### A. Release blockers

| # | Problem | Fix |
| --- | --- | --- |
| A1 | **No codebase.** The game is a single HTML artifact and the repo is empty. | S1: scaffold the project and port the engine. |
| A2 | **Debug controls ship to players.** "+1 hour", ×10/×100 speed and "Fast-forward" are in the main UI. Offline time is also multiplied by the saved test speed (`step(el*S.speed)`). | Dev-only flag; speed never touches offline time. |
| A3 | **Saves are fragile.** One localStorage key, no versioning, export or backup. | Versioned save, migrations, export/import, backup slot. |
| A4 | **The depot token is nearly free** via resold bought goods. | Resolved by removing market buying (decision D3). |
| A5 | **Credits can buy reputation** (buy → refine → donate). | Resolved by removing market buying (decision D3). |
| A6 | **Credits have nothing to buy** in Phase 1. | Starship modules become the credit sink (section 2). |
| A7 | **The ship is the v0.1 goal but isn't designed enough to build.** Undefined: parts per module, ship level, what "launch-ready" means, fuel numbers. | Decided in S6 using the balance sim (section 2 has the proposal). |
| A8 | **The ship takes too long at current numbers.** With XP ×12, Mining 65 (cryolite, needed for engine coils) is ~155 h of pure mining, and Mining 75 (palladium, needed for nav circuits) is ~345 h. Because refining and crafting share your single action slot, the real time is longer still. A crafted first ship would take well over a month. | Pick a target launch time (open question Q1), then tune either the XP multiplier or the level requirements for launch parts. |

Hours of pure mining to reach a level, by XP multiplier:

| Multiplier | Level 30 | Level 50 | Level 65 | Level 75 | Level 99 |
| --- | --- | --- | --- | --- | --- |
| ×12 (current) | 12 | 51 | 155 | 345 | 2,058 |
| ×8 | 8 | 34 | 103 | 230 | 1,372 |
| ×6 | 6 | 26 | 77 | 173 | 1,029 |

### B. Doc vs prototype

| # | Issue | Ruling |
| --- | --- | --- |
| B1 | The doc says the engine unlocks belt hops; the prototype switches colonies freely. | **Free switching in Phase 1** (decided). |
| B2 | Stall: the prototype makes selling your one action. | Keep for v0.1; revisit after playtests. |
| B3 | Offline replays every action instead of using formulas. | Acceptable (72 h ≈ 100k steps); cap steps. |
| B4 | Rough gem value isn't in the GDD (prototype: 40). | Add to GDD. |
| B5 | GDD open-decision checkboxes are stale. | Tidy GDD at S8. |

### C. Pacing that already works (from the sim)

- Oil chain step 1: ~2.6 h. Step 3 level gates: ~11 h.
- Max home rank: ~122 h (~5 days) if you donate everything.

### D. Smaller issues (fix during the port)

- Prune old `tasks.done` keys from the save.
- Remove the `window.claude.hot` artifact hooks.
- First-run guidance is missing.
- The return screen is still a text line.

---

## 2. v0.1 scope

**Goal of v0.1:** the player levels every skill, builds a spacecraft up to the launch threshold and **launches off the home asteroid**. That first launch is the v0.1 ending and the trigger for Phase 2.

**In:**
- Mining, Refining, Crafting, Trading.
- 3 colonies, free switching.
- Reputation and fees. Ranks also gate the kit trader (rank 4) and shipyard steps (see below).
- Selling: stall, broker, donate. **No market buying** (decision D3).
- Kit trader (buying kits is fine: kits can't be resold or donated).
- Oil depot chain, repeatable contracts.
- Depletion, momentum, random events, offline progress (24 h + 48 h).
- Return screen, first-run guidance, save export/import, mobile layout.
- **Starship (new in v0.1):** a hangar with module slots, module building, a ship level, and a launch.
- **Minimal fuel:** extract oil at the depot, refine it into fuel, and the launch burns fuel.
- **Launch ending:** a launch screen and a "Phase 2 coming" ending that keeps the save.

**Proposed starship design for v0.1 (tune in S6 with the sim):**
- Each module is built in the hangar from **N crafted parts + a credit installation fee** (the credit sink).
- **Launch-ready** = hull frame + power core + life support + engine installed, plus enough fuel. The cargo hold and nav computer are optional in v0.1 and give their GDD Phase 1 bonuses.
- **Ship level** = the sum of installed module tiers. v0.1 only needs the launch threshold; Phase 2 expands customization.
- Reputation gate: the hangar opens at home rank 5, and engine installation needs home rank 8. This keeps "reputation unlocks you" now that the market is gone.

**Out (Phase 2):** ship customization depth, travel odds, Piloting, travel events, other asteroids and worlds, robots and bunks, export contracts, task board bids, market buying (if it returns, it needs the tagging design).

---

## 3. Tech plan

- **Vite + TypeScript**, no framework. Deploy as a static site to **GitHub Pages** via GitHub Actions.
- `src/engine/`: pure, deterministic rules (injectable RNG and clock), unit-tested with Vitest.
- `src/ui/`: the screens.
- `src/data/*.ts`: data tables copied from the GDD.
- Balance sim in TypeScript on the real engine; runs in CI as a pacing check (replaces `tools/pacing_sim.py`).
- Save: `{ version, state }` JSON, migrations, export/import, backup slot.
- Dev panel only in dev builds or with `?dev=1`.

---

## 4. Work sessions

Each session ends with tests passing, a commit and push, and these checkboxes updated.

- [ ] **S1 — Scaffold + data.** Vite/TS/Vitest, lint, CI, Pages deploy, `CLAUDE.md`, all data tables, XP curve, ranks and fees, with tests.
- [ ] **S2 — Core engine.** Action loop, mining (yield, fee, kit, momentum, depletion, gems), refining, NPC refiner, crafting, random events, offline progress with the cap.
- [ ] **S3 — Economy engine.** Stall pricing curve, broker, donate, kit trader, oil chain, repeatable contracts. Market buying removed. Balance sim in CI.
- [ ] **S4 — UI port.** All screens rebuilt on the engine with the mood board styling; phone layout.
- [ ] **S5 — Return screen + first run + saves.** Return screen sequence, first-run guidance, versioned save, export/import, dev panel behind a flag.
- [ ] **S6 — Starship design pass.** Use the sim to set parts per module, install fees, rank gates, fuel numbers and the XP/level tuning for the target launch time. Write the results into the GDD.
- [ ] **S7 — Starship + fuel + launch.** Hangar, module building and effects, ship level, oil extraction and fuel refining, launch screen and the v0.1 ending.
- [ ] **S8 — Playtest + balance + release.** Full playthrough with the sim and by hand, tune, update the GDD, tag v0.1, publish.

---

## 5. Decisions log

| # | Decision | Status |
| --- | --- | --- |
| D1 | v0.1 goal: level the skills, build the ship, launch off the asteroid → triggers Phase 2 | **Decided** (2026-11-23) |
| D2 | Free colony switching in Phase 1 | **Decided** |
| D3 | Remove market buying for v0.1 (no bought-goods tagging needed); kit trader stays | **Decided** |
| D4 | Tech stack: Vite + TypeScript on GitHub Pages | Proposed — awaiting answer |
| D5 | Stall uses the single action slot | Proposed |
| D6 | Starship design in section 2 (modules from parts + fee, launch-ready set, rank gates) | Proposed |
| Q1 | Target real time from new save to first launch | **Open** |
| Q2 | Can modules (or the whole ship, ~10M) also be bought with credits instead of crafted? | **Open** |
