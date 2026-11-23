# Deepcore — Release Plan (v0.1 "The Colony")

Written 2026-11-23 in a planning session. Read this together with `docs/GDD.md` (the rules source of truth) at the start of every work session. Update the checkboxes as sessions finish.

Sources reviewed: the GDD, the v9 playable prototype (single HTML artifact), the mood board, and a pacing simulation (`tools/pacing_sim.py`).

---

## 1. Review findings

### A. Release blockers (they would break the game or make it trivial)

| # | Problem | Where | Fix |
| --- | --- | --- | --- |
| A1 | **No codebase.** The game is a single HTML artifact with an empty repo. It has no build, no tests and no hosting. | repo | Session 1: scaffold the project and port the engine. |
| A2 | **Debug controls ship to players.** "+1 hour", ×10/×100 speed and "Fast-forward" are in the main UI. Offline time is also multiplied by the saved test speed (`step(el*S.speed)`), so a save left on ×100 gets 100× offline progress. | prototype `start()` | Move these behind a dev-only flag, and never let speed touch offline time. |
| A3 | **Saves are fragile.** One localStorage key, ad-hoc migration and no export or backup. Clearing site data wipes the player. | prototype `save()` | Add a versioned save schema with migrations, export/import as text, and a rolling backup slot. |
| A4 | **The depot token is nearly free.** Step 4's sales total counts bought goods. Bought goods resell at up to what you paid, so buying stock and reselling it at ≥ cost earns the token for close to 0 credits. This breaks the GDD rule that bought goods don't count toward contracts. | prototype stall code | Only count untagged sales toward contract totals. |
| A5 | **Credits can buy reputation.** Refining or crafting removes the bought tag, so: buy ore or bars → refine/craft → donate → reputation. Bronze example: 7 credits buys 8 rep + 2 credits + XP. With bought bars (steel + cobalt steel → hull frames), one 8 h restock gives about 36k rep. This breaks the "no one can buy their way through" pillar. | GDD Economy + prototype | **Proposed:** processed goods keep a *tagged value* equal to the bought inputs. Reputation and contract credit count only the value added above it. |
| A6 | **Credits have nothing to buy.** In Phase 1 credits only buy kits (≤150k total) and market goods. Mid-game players pile up credits with no goal, and the 10M starship isn't buildable yet. | GDD scope | Ship 1–2 starship modules (cargo hold + power core) as credit and crafting sinks, or define a clear Phase 1 finish line (see decisions). |

### B. Contradictions between the doc and the prototype (pick one so sessions don't fight)

| # | Doc says | Prototype does | Proposed ruling |
| --- | --- | --- | --- |
| B1 | The engine unlocks belt hops between colonies. | Colonies switch freely. | **Free switching in Phase 1.** Otherwise silicate, titanium, cryolite and palladium are unreachable, and life support, engine coils and nav circuits can't be crafted. |
| B2 | Stall: "3 s per sale" (unclear whether it uses your action). | The stall *is* your one action (selling blocks mining). | Keep it as the single action for v0.1 and revisit after playtests. |
| B3 | Offline: "compute with formulas, never replay". | Replays every action one by one. | Fine for performance (72 h is about 100k steps). Switch to closed-form math later, or keep replay but cap the step count. |
| B4 | Rough gem value isn't listed. | 40 credits. | Add it to the GDD data tables. |
| B5 | The open-decision checkboxes are unticked but marked "Decided". | — | Tidy the GDD. |

### C. Pacing check (`tools/pacing_sim.py`, playing 24/7, donating everything at home)

- **Oil chain step 1** (600 copper + 600 tin at a 60% fee): about **2.6 h**. ✅ Matches the GDD.
- **Step 3 gates** (Refining 15, Crafting 10, Mining 20 for nickel): reached around **11 h**. ✅ Reasonable.
- **Max home rank:** about **122 h (~5 days)** at Mining 51 / Refining 53 / Crafting 46. ✅ Matches "about 6 days". It leaves almost no credits, though.
- **XP curve ×12:** Mining 75 takes **345 h** of pure mining, and level 99 takes **~2,050 h**. ⚠️ Nav circuits need Crafting 75 *and* palladium (Mining 75), so the **crafted-ship route is well over a month**, not the "~2 weeks" in the GDD. The buy route (10M at ~25k credits/h late game) is about 17 days of 24/7 play.
  - This doesn't block v0.1 if the ship isn't the v0.1 goal. Revise the GDD's ship timing, or lower the ×12 multiplier / part level requirements before Phase 2.

### D. Smaller issues (fix during the port)

- `tasks.done` (repeatable contract keys) grows forever in the save; prune old windows.
- Trading XP is earned by reselling bought goods at break-even (a minor XP farm).
- The `window.claude.hot` artifact hooks need removing in the real build.
- There's no first-run guidance: a new player lands on the belt map with no prompt toward "mine copper".
- The return screen is still a text line, while it's a core pillar ("zero friction").

---

## 2. v0.1 release scope (proposed)

**In:** Mining, Refining, Crafting, Trading; 3 colonies with free switching; reputation, fees and the rank unlock table; the market with restock and bought-goods tagging (with the A5 fix); the kit trader; the oil depot chain; repeatable contracts; depletion, momentum and random events; offline progress (24 h + 48 h cap); **the return screen**; first-run guidance; save export/import; mobile layout from the mood board.

**Stretch:** starship modules — cargo hold and power core — as the long-term credit sink.

**Out (Phase 2):** fuel and oil extraction, the engine and nav computer, travel, Piloting, robots and bunks, export contracts, task board bids.

**Finish line for v0.1 players:** finish the oil depot chain, then reach rank 10 at home. With the stretch modules, install the cargo hold and power core.

---

## 3. Tech plan (proposed)

- **Vite + TypeScript**, no framework (the prototype is already vanilla DOM). Static build deployed to **GitHub Pages** through GitHub Actions.
- **Engine separate from UI:** `src/engine/` holds pure, deterministic functions (state in → state out, injectable RNG and clock) and is fully unit-tested with Vitest. `src/ui/` renders the screens.
- **Data tables** go in `src/data/*.ts`, copied exactly from the GDD tables; the GDD stays the source.
- **Balance sim** in TypeScript, reusing the real engine (it replaces `tools/pacing_sim.py`) and running in CI as a pacing regression check.
- **Save:** `{ version, state }` JSON, migrations by version, export/import, and a backup slot.
- Dev panel (speed, fast-forward, grant items) only when `import.meta.env.DEV` is set or `?dev=1` is in the URL.

---

## 4. Work sessions

Each session ends with the tests passing, a commit and a push, and these checkboxes updated.

- [ ] **S1 — Scaffold + data.** Vite/TS/Vitest, lint, CI, Pages deploy, `CLAUDE.md` (points to GDD + PLAN), all data tables, XP curve, ranks and fees, with tests.
- [ ] **S2 — Core engine.** Action loop, mining (yield, fee, kit, momentum, depletion, gems), refining, NPC refiner, crafting, random events, offline progress with the cap, tests.
- [ ] **S3 — Economy engine.** Stall pricing curve, broker, donate, market buy and restock, bought-goods tagging with the A4/A5 fixes, kit trader, oil chain, repeatable contracts, tests. Balance sim in CI.
- [ ] **S4 — UI port.** The prototype's screens rebuilt on the engine, using the mood board styling; belt map, colony hub, mining, refinery, workshop, market, task board, log; phone layout.
- [ ] **S5 — Return screen + first run.** The GDD return-screen sequence (headline, skill bars, event cards, best last, Collect all, next goal), plus first-run guidance.
- [ ] **S6 — Save system + settings.** Versioned save, migrations, export/import, backup, dev panel behind a flag, reset with confirmation.
- [ ] **S7 — (stretch) Starship modules.** Cargo hold + power core: recipe counts decided, installed effects.
- [ ] **S8 — Playtest + balance + release.** Run the sim and real playthroughs, tune the numbers, update the GDD, tag v0.1, publish.

---

## 5. Decisions log

| Decision | Status |
| --- | --- |
| v0.1 scope and finish line (section 2) | Proposed |
| Free colony switching in Phase 1 (B1) | Proposed |
| Value-added reputation rule for bought inputs (A5) | Proposed |
| Stall uses the single action slot (B2) | Proposed |
| Tech stack and hosting (section 3) | Proposed |
| XP ×12 kept for v0.1; ship timing revisited before Phase 2 (C) | Proposed |
| Crafted parts per major starship part (needed only for S7) | Open |
