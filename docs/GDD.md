# Deepcore — Game Design Document

Nov 21, 2026 · @David Alvarez

## Overview

Deepcore is a single-player browser idle game: you start as a miner on a far-sector asteroid colony and work toward your first starship. It plays like Melvor Idle, with a Star Citizen-inspired original universe. This doc is the rules source of truth for every coding session.

**Design pillars**

- **Every skill feeds another.** Mining feeds Refining, Refining feeds Crafting and Trading, and all of it feeds reputation and travel.
- **Where you work matters.** Each colony has its own fee, reputation and prices.
- **Zero friction when you return.** Players open the game now and then; every visit should pay off in seconds.
- **Credits speed you up, reputation unlocks you.** No one can buy their way through the game.

**Scope**

- **Phase 1 (current build):** the colony loop — Mining, Refining, Crafting, Trading, reputation, missions, market.
- **Phase 2:** starship, Piloting and travel.
- Later phases are in the roadmap section.

**Look and feel** comes from the [mood board](https://claude.ai/artifact/RGDFRU2vuGAdGyoLCfPCyj), not this doc. Related: the [design whiteboard](https://claude.ai/artifact/8nhduNPerC3bbdCPJeZexb) and the [playable prototype](https://claude.ai/artifact/Q6Firzco1jHf3v3BJsfFwR). Deepcore is a working title.

## Core loop and skills

The loop is mine → refine → craft → sell or donate, and it ends at a starship. Every action repeats on a timer until the player changes it or runs out of inputs.

1. **Mine** ore in a colony shaft. The colony takes its fee from the ore, never from XP.
2. **Refine** ore into bars, yourself or through an NPC refiner who keeps 40%.
3. **Craft** bars and gems into starship parts and jewelry.
4. **Sell** at a stall (credits, a little reputation) or **donate** to a colony (mostly reputation).
5. **Reach a starship** by buying one (\~10M credits), crafting the parts, or reaching max reputation.

| Skill | What it does | Action time | Levels up |
| --- | --- | --- | --- |
| Mining | Ore + a small gem chance (1%, 3% in level 50+ mines) | 3 s | +2% yield per level |
| Refining | Ore into bars only | 2 s | +2% speed per level |
| Crafting | Starship parts, polished gems, jewelry — never kits | 3 s | +2% speed per level |
| Trading | Runs your market stall | 3 s per sale | Better best price, +3% stall speed per level |
| Piloting (Phase 2) | Trained by every trip, even failures | — | Adds to ship rating |

**Shared rules**

- XP curve: RuneScape-style, scaled ×12; level cap 99.
- XP counts ore mined before the fee.
- **Momentum:** +5% output per 30 min on the same action, max +25%. Starts at skill level 10, counts offline, resets when you switch.
- No setup or travel time inside a colony.

## Colonies, reputation and fees

Reputation is tracked per colony and is the main progression gate: it lowers that colony's mine fee and unlocks what its market will sell you. Standing in one colony never carries over to another.

| Colony | Ores | Bars refined there | Starting fee | Local demand |
| --- | --- | --- | --- | --- |
| Deepcore Colony Authority (home) | Copper, Tin, Iron, Nickel, Cobalt | Bronze, Steel, Cobalt Steel | 60% | Only colony with a broker; bars −10% |
| Miners' Union Deepshafts | Cobalt, Silicate, Ferrocite, Titanium, Gravium | Cobalt Steel, Ferro-Titanium | 75% | Bars +10%, ship parts +15% |
| Corporate Claim | Gravium, Cryolite, Palladium, Nullstone | Ferro-Titanium, Gravsteel | 85% | Gems and jewelry +30%, ore +5% |

**Reputation ranks**

- Ranks 0–10. Rank n needs 25,000 × n² reputation in that colony.
- The fee falls in even steps from the starting fee to 10% at rank 10.
- Max home rank takes about 6 days of play.

**Earning reputation**

- Donating: 80% of the item's value as reputation, 20% as credits.
- Selling at the stall: 20% of the item's value as reputation (based on value, not your price).
- Mission turn-ins: a large reputation gain.
- Underbidding NPC refining jobs on the task board (not built yet).

**Max reputation** earns a government trading vessel with a mercenary escort (Phase 2).

## Economy

Players earn credits by selling and spend them in a reputation-gated market, and buying must never beat selling. Bars are worth about 2× their raw ore.

**Ways to cash out**

| Channel | Credits | Reputation | Speed | Where |
| --- | --- | --- | --- | --- |
| Stall | Your price × local demand | 20% of value | One sale per tick (see curve) | Any colony |
| Broker | 60% of value | 20% of value, to the Authority | Instant | Home only |
| Donate | 20% of value | 80% of value | Instant | Any colony |

**Stall pricing curve**

- The player sets each item's price from 25% to 300% of local market value.
- **Best price** = 75% + 0.5% per Trading level (about 124% at level 99). At the best price, credits per hour peak.
- Sales speed multiplier:

```latex
\text{speed} = \min\left(3,\; e^{(p^{*} - p)/p^{*}}\right)
```

- p is the player's price and p\* the best price. Higher sells slower; lower sells faster, up to 3×.
- Bulk selling lowers the price (floor 50%) and recovers over hours (not built yet).

**Market buying**

- Everything is for sale: ores, bars and starship materials, each unlocked at a reputation rank in that market's colony.
- Buy price starts at 140% of market and falls with Trading level to a floor of 130%, always above the best resale.
- Processed goods cost more than ore.
- **Restock:** 250 of each item every 8 hours, worked out from timestamps.
- **Never sold:** specialty bars. Players refine them and craft specialty ship parts that raise travel odds. They aren't needed to reach Phase 2.

**What each reputation rank unlocks** (in that colony's market; each colony sells its own ores and bars, and every colony sells crafted goods)

| Rank | Unlocks to buy |
| --- | --- |
| 0 | Nothing: sell only |
| 1 | Ores up to Mining level 5 (copper, tin) |
| 2 | Ores up to level 20 (iron, nickel) + bronze bars |
| 3 | Ores up to level 33 (cobalt, silicate) + steel bars |
| 4 | Ores up to level 50 (ferrocite, titanium) + cobalt steel bars + the kit trader |
| 5 | Ores up to level 65 (gravium, cryolite) + ferro-titanium bars |
| 6 | All remaining ores + gravsteel bars |
| 7 | Ship parts: bronze fittings, steel plating, cargo hold sections |
| 8 | Ship parts: hull frame sections, power core cells, life support modules |
| 9 | Ship parts: engine coils, nav circuits |
| 10 | Polished gems and jewelry |

**The loophole fix: bought goods are tagged.**

- Bought goods resell at the stall for no more than the player paid, whatever price they set.
- Bought goods earn no reputation when sold, donated or turned in, so credits can't buy standing.
- Bought goods don't count toward contracts.
- Bought units are always the last ones sold or used. Refining or crafting them removes the tag, because the work adds real value.

**Mining kits**

- Kits multiply mining yield and are never crafted.
- They come free from missions, or from the kit trader at rank 4 in that colony, priced high enough to make players hesitate.
- Kits you own stay yours; the best one you can use is equipped automatically.

## Contracts: the task board and the oil depot chain

The first mission chain teaches every skill and unlocks fuel, the gate to Phase 2; players should finish it around level 30. Each step opens only when the last is done.

1. **Ore turn-in.** Deliver a large batch of copper and tin, sized to about 2–3 hours of mining at the start. Reward: Mining XP, a large reputation gain and the next mining kit.
2. **Bronze bars.** Refine copper and tin into bronze bars and turn them in.
3. **Starship parts.** Craft small starship parts and turn them in (they can also be sold).
4. **Run a stall.** Sell anything until your total sales *value* (not quantity) earns a token.
5. **Turn in the token.** Reward: the oil depot and the oil depot kit.

**There's no separate quest system: everything is a contract on each colony's task board.** The oil depot chain is the Authority's story contract, and repeatable mining and refinery contracts sit beside it.

**Oil depot chain rewards** (reputation goes to the Authority)

| Step | Deliver | Reward |
| --- | --- | --- |
| 1. Ore for the depot | 600 copper + 600 tin | 10,000 rep, 2,000 Mining XP, Bronze Kit |
| 2. Bronze for the scaffold | 300 bronze bars | 15,000 rep, 1,500 credits, 3,000 Refining XP |
| 3. Fittings for the pumps | 100 bronze fittings + 40 steel plating | 25,000 rep, 4,000 credits, 3,000 Crafting XP, Steel Kit |
| 4. Open for business | Sell 25,000 credits of goods at your stall | Depot token |
| 5. Hand in the token | The depot token | 40,000 rep, oil depot + oil depot kit |

**Repeatable contracts**

- Each colony posts 3 contracts every 8 hours, picked from items you can already make there.
- Mining contracts ask for 300 ore; refinery contracts ask for 100 bars.
- Reward: 130% of the goods' value in credits, plus 80% of the value as reputation with that colony.
- Only goods you made yourself count.

**Sizing the first delivery:** at a 3 s action and a 60% → 50% fee, 2.5 hours keeps about 1,300 ore. Start at roughly 600 copper + 600 tin and tune in playtests.

**Fuel**

- Oil exists in only one colony section, separate from the colony mines, and needs the oil depot kit.
- Players extract oil and refine it into fuel.
- Every launch of a ship burns fuel, which stops players from spamming instant travel rolls.
- Players who skip missions can still buy kits from the kit trader (see Economy).

## Starship modules (useful in Phase 1)

The ship is built module by module, and each module pays off the moment it's installed, so players use the ship long before it leaves the belt. The engine and nav computer then gate how far it can fly.

| Module | Effect once installed | Upgrades |
| --- | --- | --- |
| Cargo hold | Raises the market buy limit per restock (e.g. 250 → 375) and caps the size of export contracts | Bigger holds |
| Power core | +10% mining speed in your mines | — |
| Bunks | Houses mining robots, one per bunk: the start of your crew | More bunks, better robots |
| Hull frame | Bad random events leave a silver lining: a cave-in exposes gems, a critter attack drops salvage | — |
| Engine | Space travel engine unlocks belt hops between colonies; light-speed enhancers unlock travel outside the belt, which starts Phase 2 | Enhancers |
| Nav computer | Shows which colony pays best for each item; you can only fly as far as it maps | Map enhancers widen range |

**Mining robots**

- Bought at the market and housed in bunks, one robot per bunk.
- A robot mines at half your rate, worked out at half your Mining level (Mining 40 → a level-20 robot). It pays the colony fee and earns you no XP.
- **Scaling (proposal):** robot tiers from Bronze to Gravsteel multiply robot output from ×1.0 to ×1.5, and bunks expand from 1 to 3.

**Inventory** stays unlimited. The cargo hold only limits buying and hauling, never what you can store.

**Export contracts**

Once the ship is good enough, it runs export contracts on its own while you keep mining, refining or crafting, so you have two actions running at once.

- **Unlock:** a minimum ship level plus an installed nav computer, which comes with an AI pilot that flies contracts for you.
- **Fixed durations:** each contract has a set time, such as 3 or 5 hours, shown before you accept it.
- **Rewards:** mainly reputation with the colony that posted it, plus credits.
- **Goods are locked in at the start:** the required items leave storage when the contract begins, so your own actions can't use them mid-flight.
- **One contract at a time** to start. The cargo hold sets the biggest order you can take.
- Contracts finish offline like any other timer and show up on the return screen.

**Selling stays simple:** storage is shared across the belt and you can sell anywhere. Real cargo hauling waits for Phase 2.

## Travel (Phase 2)

Travel is one instant roll at launch: success puts the player at the destination at once, ready to idle there. Failure always pays something, so even a 10% route is worth trying.

- **Success chance** = ship rating ÷ destination danger. Ship rating = ship level + upgrades + Piloting + escorts.
- The roll happens when the player launches, so they always see the result. Nothing goes wrong while they're offline.
- Every launch burns fuel.
- Every failure pays Piloting XP, salvage and route data.

**Failure split** (shares of the failure chance)

| Success chance | Turn back (75%) | Encounter (15%) | Crash (10%) |
| --- | --- | --- | --- |
| 10% | 67.5% | 13.5% | 9% |
| 30% | 52.5% | 10.5% | 7% |
| 50% | 37.5% | 7.5% | 5% |
| 70% | 22.5% | 4.5% | 3% |
| 90% | 7.5% | 1.5% | 1% |

- **Turn back:** back at the departure colony with XP, no loss.
- **Encounter:** a roll on its own event table, good (rare ore, derelict salvage) or risky (pirates, debris).
- **Crash:** crash landing at the departure colony with a costly repair. Repair cost grows with route difficulty.

**Paths to a first ship**

- **Trader path:** an early, weak ship and risky runs, such as an abandoned colony with no fees.
- **Prestige path:** later, a government vessel with mercenary escorts and better odds.
- Specialty ship parts from never-sold bars raise travel odds further.

## Idle systems and the return screen

The game keeps working while the player is away, and the return screen turns that time into a burst of rewards in under 5 seconds.

**Offline progress**

- On leave: save the current action, a timestamp and the player's stats.
- On return: work out time away and compute results with formulas (actions = time ÷ action time). Never replay actions one by one.
- **Cap:** the first 24 hours count fully, the next 48 at half, nothing after 72 hours.
- Momentum is added in 30-minute blocks. An action stops when its inputs run out. Market restocks come from timestamps.
- Clock changes on the device can cheat this. Accept it for now, or check server time later.

**Mine depletion**

- Each mine loses 2% yield per 30 minutes of use, up to 15%.
- It recovers when the player mines elsewhere.

**Random events**

- Auto-resolved, about 60% good and 40% bad, always small.
- Mining: rich vein, lost gem pocket, inspector visit, broken wheelbarrow, cave-in, tunnel critter.
- Refining: perfect pour, furnace flare-up. Crafting: steady hands, tool slip. Stall: generous haggler, short-changed.

**Return screen, shown in order**

1. **Headline:** time away, with total credits counting up fast.
2. **Skill bars fill,** with a burst and a sound for every level-up.
3. **Event cards flip in.** Good ones are bright; bad ones are small and grey, with the loss already taken.
4. **Best last:** a rare gem, new kit or finished mission step gets a full-screen reveal.

**Return screen rules**

- 3–5 seconds in total; one tap skips to the summary.
- One **Collect all** button. Rewards bank automatically.
- Show the next goal with a progress bar, and timers such as the next market restock.
- One tap to switch actions from the summary.

## Data tables

These are the first-pass numbers in the prototype; tune them in playtests. Values are in credits.

**Ores**

| Ore | Mining level | Yield per action | XP | Value | Use |
| --- | --- | --- | --- | --- | --- |
| Copper | 1 | 1.0 | 5 | 2 | Wiring, starter ore |
| Tin | 5 | 0.95 | 7 | 3 | Bronze, with copper |
| Iron | 12 | 0.85 | 10 | 5 | Steel, hull plating |
| Nickel | 20 | 0.8 | 13 | 7 | Steel alloys |
| Cobalt | 28 | 0.7 | 17 | 9 | Power cells |
| Silicate | 33 | 0.65 | 19 | 4 | Viewport glass |
| Ferrocite | 40 | 0.55 | 24 | 15 | Engine coils |
| Titanium | 50 | 0.4 | 30 | 20 | Ship frames |
| Gravium | 58 | 0.35 | 36 | 30 | Gravity drives |
| Cryolite | 65 | 0.3 | 40 | 12 | Coolant |
| Palladium | 75 | 0.22 | 50 | 45 | Electronics, jewelry |
| Nullstone | 85 | 0.1 | 75 | 1 | Joke ore: XP and bragging rights |

**Bars**

| Bar | Refined from | Refining level | XP | Value |
| --- | --- | --- | --- | --- |
| Bronze | 1 Copper + 1 Tin | 1 | 10 | 10 |
| Steel | 2 Iron + 1 Nickel | 15 | 25 | 34 |
| Cobalt Steel | 1 Steel + 2 Cobalt | 30 | 45 | 104 |
| Ferro-Titanium | 2 Titanium + 1 Ferrocite | 50 | 70 | 110 |
| Gravsteel | 1 Palladium + 2 Gravium | 70 | 110 | 210 |

**Mining kits** (drill, shovel, scanner, harness)

| Kit | Use at Mining level | Yield | Kit trader price |
| --- | --- | --- | --- |
| Starter Kit | 1 | ×1.0 | Free |
| Bronze Kit | 12 | ×1.1 | 2,500 |
| Steel Kit | 28 | ×1.2 | 8,000 |
| Cobalt Steel Kit | 50 | ×1.3 | 25,000 |
| Ferro-Titanium Kit | 75 | ×1.4 | 60,000 |
| Gravsteel Kit | 85 | ×1.5 | 150,000 |

**Crafting recipes**

| Item | Type | Crafting level | Made from | XP | Value |
| --- | --- | --- | --- | --- | --- |
| Bronze fittings | Ship part | 1 | 2 Bronze | 15 | 30 |
| Steel plating | Ship part | 10 | 2 Steel | 35 | 90 |
| Cargo hold section | Ship part | 15 | 3 Bronze + 2 Steel | 50 | 140 |
| Hull frame section | Ship part | 30 | 2 Steel + 2 Cobalt Steel | 95 | 360 |
| Power core cell | Ship part | 35 | 3 Cobalt + 1 Cobalt Steel | 70 | 190 |
| Life support module | Ship part | 50 | 1 Ferro-Titanium + 3 Silicate | 85 | 180 |
| Engine coil | Ship part | 65 | 1 Ferro-Titanium + 2 Cryolite | 105 | 200 |
| Nav circuit | Ship part | 75 | 1 Palladium + 2 Silicate | 120 | 120 |
| Polished gem | Jewelry | 1 | 1 Rough gem | 20 | 90 |
| Bronze gem ring | Jewelry | 10 | 1 Polished gem + 1 Bronze | 40 | 150 |
| Steel gem amulet | Jewelry | 25 | 1 Polished gem + 2 Steel | 65 | 240 |
| Gravsteel gem circlet | Jewelry | 70 | 2 Polished gems + 1 Gravsteel | 160 | 600 |

**Starship (\~10M credits to buy):** a player reaches it in about 2 weeks as a generalist, 3 as a pure miner. Major parts to buy or build: cargo hold 0.9M, hull frame 1.8M, power core 1.5M, life support 1.2M, engine 2.6M, nav computer 2.0M. How many crafted parts make one major part is still open.

## Roadmap, build status and open decisions

The prototype (v8) covers most of Phase 1's colony loop; missions, market buying and the return screen are the next build.

**Phases**

1. **The Colony.** Mining, Refining, Crafting, Trading, reputation, missions, market, depletion, momentum, random events.
2. **First Flight.** Starship, Piloting, travel odds, fuel. Combat only during travel: pirates, escorts, mercenaries.
3. **Three paths.** Trader empire (inward to the rich center), Explorer (outward past the belt, survival tools), Fighter (bounties, monster hunts, conquering asteroids).
4. **War events.** Opt-in wars between advanced races. A combat score unlocks the hidden General skill, which grants more troops as it levels.

Later ideas: 30–40 more ores found by traveling, rare-ore asteroids with a rich-vein bonus (about +40% for the first 2 trips), limited ship cargo that grows with upgrades, and a possible multiplayer economy.

**Build status**

| Area | Status |
| --- | --- |
| Mining, Refining, depletion, gems | Built |
| Crafting: ship parts, gems, jewelry | Built (v7) |
| Stall pricing curve | Built (v8) |
| Kit trader at rank 4 | Built (v7) |
| Belt map, colony hubs, inventory | Built |
| Offline progress with the 24 h + 48 h cap | Built (v7); still a text message, not the return screen |
| Oil depot contract chain (built v9); fuel | Designed |
| Market buying and restock (built v9) | Designed |
| Return screen | Designed |
| Task board bids | Not designed |
| Travel | Designed (Phase 2) |

**Open decisions**

- [ ] Decided: bought goods are tagged — they resell for no more than their cost and earn no reputation (built in v9).
- [ ] Decided: rank unlock table in Economy (built in v9).
- [ ] How many crafted parts make each major starship part.
- [ ] Fuel numbers: oil per action, fuel per launch, and the refining recipe.
- [ ] The encounter event table for travel.
- [ ] Task board: how NPC refining jobs and bids work.
- [ ] Final game title.

* [ ] Starship power scaling: an overall ship level built from its modules, which gates export contracts and travel. Also decide whether belt hops are still needed.
