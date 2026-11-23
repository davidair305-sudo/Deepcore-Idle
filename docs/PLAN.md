# Deepcore — Release Plan (v0.1 "The Colony")

Written 2026-11-23 in a planning session. Read this together with `docs/GDD.md` (the rules source of truth) at the start of every work session. Where this plan and the GDD disagree, **this plan's decisions log (section 6) wins** until the GDD is updated. Update the checkboxes as sessions finish.

Sources reviewed: the GDD, the v9 playable prototype (single HTML artifact), the mood board, and a pacing simulation (`tools/pacing_sim.py`).

---

## 1. Review findings

### A. Release blockers

| # | Problem | Fix |
| --- | --- | --- |
| A1 | **No codebase.** The game is a single HTML artifact and the repo is empty. | S1: scaffold the TypeScript project and port the engine. |
| A2 | **Debug controls ship to players.** "+1 hour", ×10/×100 speed and "Fast-forward" are in the main UI, and offline time is multiplied by the saved test speed (`step(el*S.speed)`). | Dev-only flag; speed never touches offline time. |
| A3 | **Saves are fragile.** One localStorage key, no versioning, export or backup. | Versioned save, migrations, export/import, backup slot. |
| A4 | **The depot token is nearly free** via resold bought goods. | Resolved: market buying removed (D3). |
| A5 | **Credits can buy reputation** (buy → refine → donate). | Resolved: market buying removed (D3). |
| A6 | **Credits have nothing to buy.** | Module installation fees, launch repairs and kits become the credit sinks (section 2). |
| A7 | **The ship is the v0.1 goal but isn't designed yet.** | Quality system (section 3) + S6 design pass. |
| A8 | **The ship takes too long at current numbers.** With XP ×12, Mining 65 (cryolite, for engine coils) is ~155 h of pure mining and Mining 75 (palladium) ~345 h. | The quality system splits "can launch" from "likely to arrive". Tune so a decent-odds ship lands in 2–3 weeks (see A9). |
| A9 | **Twice-a-day play means only ~2 action switches a day.** You have one action slot, so a 12 h stretch is all mining *or* all refining. Mine → refine → craft would advance one step per check-in, and the 2–3 week target becomes ~30–40 decisions in total. | **Proposed: an action queue** (e.g. "mine 3,000 copper → refine all bronze → craft fittings"), 3 slots at the start, offline-aware. Without it the target pacing doesn't work. |

Hours of pure mining to reach a level, by XP multiplier:

| Multiplier | Level 30 | Level 50 | Level 65 | Level 75 | Level 99 |
| --- | --- | --- | --- | --- | --- |
| ×12 (current) | 12 | 51 | 155 | 345 | 2,058 |
| ×8 | 8 | 34 | 103 | 230 | 1,372 |
| ×6 | 6 | 26 | 77 | 173 | 1,029 |

### B. Doc vs prototype

| # | Issue | Ruling |
| --- | --- | --- |
| B1 | The doc says the engine unlocks belt hops; the prototype switches freely. | **Free switching in Phase 1** (D2). |
| B2 | The prototype makes selling your one action. | Keep for v0.1; the action queue (A9) softens it. |
| B3 | Offline replays each action instead of using formulas. | Acceptable; cap steps. |
| B4 | Rough gem value isn't in the GDD (prototype: 40). | Add to GDD. |
| B5 | GDD open-decision checkboxes are stale. | Tidy at S8. |
| B6 | GDD robots live in bunks and mine at half rate; the new reward robot gives +25% speed to every action. | The reward robot replaces bunk robots for v0.1 (D8). |

### C. Pacing that already works (from the sim, 24/7 play)

- Oil chain step 1: ~2.6 h. Step 3 level gates: ~11 h.
- Max home rank: ~122 h of game time if you donate everything (~7–10 days at twice-a-day check-ins).

### D. Smaller issues (fix during the port)

- Prune old `tasks.done` keys; remove the `window.claude.hot` hooks; add first-run guidance; replace the text-line return screen.

---

## 2. v0.1 scope

**Goal of v0.1:** the player levels every skill, builds a spacecraft and **launches off the home asteroid**. A junk ship can launch but almost never arrives; arriving triggers the v0.1 ending and the start of Phase 2.

**In:**
- Mining, Refining, Crafting, Trading; 3 colonies with free switching.
- Reputation and fees; ranks gate the kit trader (rank 4) and the launch modules.
- Selling: stall, broker, donate. **No market buying** (D3).
- Kit trader (kits can't be resold or donated, so this is safe).
- Oil depot chain, repeatable contracts.
- Depletion, momentum, random events, offline progress (24 h + 48 h).
- **Action queue** (A9, proposed).
- **Item quality 1–100** on everything mined, refined and crafted (section 3).
- **Starship:** hangar, the 4 launch modules built from crafted parts (+ a credit install fee), ship quality, and a launch roll.
- **Minimal fuel:** extract oil at the depot, refine it into fuel; every launch burns fuel.
- **Prestige reward:** home rank 10 **and** the oil depot chain done → an awarded ship and a robot (+25% speed on every action) (D7).
- Return screen, first-run guidance, save export/import, mobile layout.
- Launch screen, failure outcomes, and an "arrived — Phase 2 coming" ending that keeps the save.

**Parked (backlog, not v0.1):**
- Ship interior.
- Buying a robot companion that travels with you (Phase 2).
- Ship customization depth, travel methods, travel random events, other asteroids and worlds, Piloting, export contracts, task board bids.
- Market buying (if it returns, it needs the tagging design).

---

## 3. Quality system (proposed — finalize numbers in S6)

Every mined, refined or crafted item has a **quality from 1 to 100**. Same item, different quality: inventory stacks by item + quality.

**Quality tiers** (names for display; the number is what counts):

| Quality | Tier |
| --- | --- |
| 1–19 | Crude |
| 20–39 | Rough |
| 40–59 | Standard |
| 60–79 | Fine |
| 80–94 | Superior |
| 95–99 | Masterwork |
| 100 | Perfect craft |

**Where quality comes from:**
1. **Ore:** each ore has a **quality ceiling** set by its level (copper is low, palladium high; only top ores can feed a 100). Mining skill above the ore's requirement moves your rolls toward that ceiling.
2. **Bars:** start from the average quality of the input ores. Refining skill sets how much quality is kept, with a chance of a better pour.
3. **Parts and modules:** start from the average quality of the inputs. Crafting skill rolls an outcome tier, which gives a chance of a better result within the same item:

   | Outcome | Quality vs inputs | Chance at low skill | Chance at high skill |
   | --- | --- | --- | --- |
   | Botched | ×0.6 | high | ~0 |
   | Standard | ×0.85 | most | some |
   | Fine | ×1.0 | low | most |
   | Masterwork | ×1.0, +5 | ~0 | some |

   **Perfect craft (100)** needs top-ceiling materials *and* a masterwork roll at very high skill.
4. **Module material tiers:** each launch module can be built from parts of any metal tier (a bronze hull frame up to a gravsteel hull frame). The tier sets the ceiling, so a full early ship is buildable but capped low. This adds variants to the recipe table (S6).
5. **Recipe input choice:** when crafting, the player picks "lowest quality first" or "highest quality first".

**Ship quality → launch odds:**
- Ship quality = the average quality of the 4 launch modules (hull frame, power core, life support, engine).
- **Arrival chance = ship quality %, never below 5% and capped at 95%.** A junk ship is a 5% gamble; a perfect ship is 95%.
- Every launch burns fuel and rolls once at launch (the GDD's travel rule).
- **Failures** (using the GDD failure split): turn back (lose the fuel); encounter (a small good or bad event); crash (back at home, and a module loses quality or needs a credit repair).
- Sale value scales with quality (e.g. ×0.75 at 1 to ×1.25 at 100; tune in S6).

**Pacing target** (D5: 2–3 weeks, checking in twice a day):

| Milestone | Target |
| --- | --- |
| First (junk) launch possible | ~3–5 days |
| Awarded ship (rank 10 + oil chain) | ~1.5–2 weeks |
| A self-crafted ship at ~50% odds | ~2–3 weeks |
| Perfect ship | long-term chase, Phase 2+ |

### 3a. Action queue slots come from the ship (proposed specifics)

The ship's computer runs your shift schedule, so queue slots are ship upgrades. You build them in the hangar like any module.

| Slots | Unlocked by | When (target) |
| --- | --- | --- |
| 1 (no queue) | Start | Day 1, hands-on |
| 2 | **Shift Scheduler**: the first hangar install, built from early parts (bronze fittings + steel plating) | ~Day 2, around oil chain step 3 |
| 3 | **Nav Computer** upgrade (the GDD module: shows which colony pays best per item) | ~Week 1 |

- Actions are start/stop. A queued step can have a **time limit** (e.g. "mine copper for 6 h"); a mining step needs one when steps come after it, since mining never runs out. Refining and crafting can also end when inputs run out. The queue obeys the 24 h + 48 h offline cap (decision D13).
- So the hangar must open early (proposed: after oil chain step 2, not at rank 5); the launch modules are where the rank gates sit.
- Export contracts (GDD: the nav computer's AI pilot flies contracts as a parallel action) stay parked for Phase 2.

---

## 4. Tech plan (decided: TypeScript)

- **Vite + TypeScript**, no framework. Deploy as a static site to **GitHub Pages** via GitHub Actions.
- `src/engine/`: pure, deterministic rules (injectable RNG and clock), unit-tested with Vitest. Items are modeled with quality from day one.
- `src/ui/`: the screens. `src/data/*.ts`: data tables from the GDD.
- Balance sim in TypeScript on the real engine (`src/sim/`, `npm run sim`), run in CI. It simulates a twice-a-day player, not 24/7 play.
- Save: `{ version, state }` JSON, migrations, export/import, backup slot.
- Dev panel only in dev builds or with `?dev=1`.

---

## 5. Work sessions

Each session ends with tests passing, a commit and push, and these checkboxes updated.

- [x] **S1 — Scaffold + data.** Vite/TS/Vitest, lint, CI, Pages deploy, `CLAUDE.md`, data tables, XP curve, ranks and fees, item-with-quality model and inventory stacks, with tests.
  - Done 2026-11-23. Lint is TypeScript strict mode for now (no ESLint). The GitHub Pages deploy needs Pages enabled (Settings → Pages → Source: GitHub Actions) and runs from `main`. The page is a placeholder that shows the data tables.
- [x] **S2 — Core engine.** Action loop + **action queue**, mining (yield, fee, kit, momentum, depletion, gems, ore quality), refining and crafting with quality rolls, NPC refiner, random events, offline progress with the cap.
  - Done 2026-11-23. Engine files: `state.ts`, `actions.ts` (rates, requirements, queue, NPC refiner), `tick.ts` (time loop), `qualityRules.ts`, `randomEvents.ts`, `offline.ts`, `rng.ts`. 48 tests.
  - Quality note: mastery is 40 levels above an item's requirement (50 for crafting), but never past level 99, so palladium and other top-tier items can still reach full quality. First check: day-one bronze fittings come out at quality ~4–11, which fits the "junk ship ≈ 5%" target.
  - Deferred: hull frame "silver lining" events (need modules, S7); the return-screen summary of an advance (S5); the stall as a queue action (S3).
- [x] **S3 — Economy engine.** Stall pricing curve, broker, donate (with quality-scaled value), kit trader, oil chain, repeatable contracts. Twice-a-day balance sim in CI.
  - Done 2026-11-23. Files: `value.ts`, `stall.ts`, `market.ts`, `contracts.ts`; sim in `src/sim/` (`npm run sim`), with guard-rail tests in CI. 76 tests.
  - First sim results (twice-a-day bot): oil chain done ~day 4.5; home rank 5 ~day 10.5; rank 10 ~day 18.5 (target 10–14 for the prestige reward, but the bot isn't optimal).
  - **Findings for S6:**
    1. **Credits pile up:** ~1.2M by day 21, and kits only cost ~245k in total. Module install fees and repairs must absorb roughly 1M+ by launch.
    2. **Crafting stalls at ~28** for a value-chasing player: between Crafting 15 and 30, crafted parts add less value per hour than donating bars. The ship requirements must be what pulls players into Crafting (S6/S7 bot goals).
    3. **Trading XP is too generous:** one sales push (oil step 4) took Trading from 1 to 29, because XP = 5 + 50% of credits per sale. Tune it.
- [ ] **S4 — UI port.** All screens rebuilt on the engine with the mood board styling; queue editor; quality shown on items; phone layout.
- [ ] **S5 — Return screen + first run + saves.** Return screen sequence, first-run guidance, versioned save, export/import, dev panel behind a flag.
- [ ] **S6 — Starship + quality design pass.** Use the sim to set quality ceilings and roll chances, module material-tier recipes, parts per module, install fees, the hangar rank gate, fuel numbers, the awarded ship's quality and the XP tuning to hit section 3's targets. Write the results into the GDD.
- [ ] **S7 — Starship + fuel + launch.** Hangar, modules, ship quality, oil and fuel, the launch roll and failure outcomes, the prestige reward (ship + robot), the ending screen.
- [ ] **S8 — Playtest + balance + release.** Full playthrough with the sim and by hand, tune, update the GDD, tag v0.1, publish.

---

## 6. Decisions log

| # | Decision | Status |
| --- | --- | --- |
| D1 | v0.1 goal: level the skills, build the ship, launch off the asteroid; arriving triggers Phase 2 | **Decided** |
| D2 | Free colony switching in Phase 1 | **Decided** |
| D3 | No market buying in v0.1; kit trader stays | **Decided** |
| D4 | Tech: Vite + TypeScript on GitHub Pages | **Decided** |
| D5 | Target time to a ship with decent odds: 2–3 weeks, checking in twice a day | **Decided** |
| D6 | Ships and modules can't be bought with credits; crafting (and the prestige reward) are the only ways | **Decided** |
| D7 | Prestige reward: home rank 10 + oil depot chain done → an awarded ship + a robot (+25% speed on all actions) | **Decided** |
| D8 | Junk ships can launch; arrival odds come from ship quality (5% minimum) | **Decided** |
| D9 | Items have quality 1–100 from materials + skill; 100 = perfect craft | **Decided** (formulas in section 3 are proposed) |
| D10 | Ship interior and a buyable travel robot are parked for later phases | **Decided** |
| D12 | Action queue slots are earned through ship computer modules (section 3a), not given at the start | **Decided** (module names and costs proposed) |
| D13 | Actions are start/stop; queued steps use optional time limits, not amounts. A mining step needs a time limit when other steps follow it | **Decided** |
| P2 | Quality formulas, tiers and arrival chance = ship quality % (section 3) | Proposed |
| D11 | The awarded ship has quality ~50 (about 50% arrival odds); a well-crafted ship beats it | **Decided** |
| D14 | Stall: list several wares, sold one unit at a time **in list order**. Each ware's price slider starts at market price (100%), range 25–300%. Speed = e^((n − p)/n), max 3×, where n is the normal-speed price: 100% at Trading 1, rising 0.25% per level to ~124.5% at 99. Running the stall is an **action** (queueable) | **Decided** |
