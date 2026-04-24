---
description: "Use when working on manager_corporation.js. Contains corp automation phases, investment round logic, product management, and office scaling."
applyTo: "manager_corporation.js"
---

# manager_corporation.js — Corporation Manager

## Purpose
Fully automatic corp manager. Progresses through phases from initial setup to endgame public corp with multiple products. Exports `getCorpStatus(ns)` for use by `manager_gui.js`.

## Module-Level Constants (intentional exception to project rule)
Constants are at module level here because they are shared across many helper functions. Do not move them inside `main()`.

## Automation Phases
1. **Setup** — unlock Warehouse & Office API, create divisions, expand to all 6 cities.
2. **Investment Round 1** — maximize corp upgrades until funds reach `INVEST_ROUND1_FUNDS_TARGET` (210 B). Then accept investment.
3. **Investment Round 2** — scale up to round 2 offices, keep upgrading until `INVEST_ROUND2_FUNDS_TARGET` (2 T). Then accept.
4. **Public** — go public, unlock Market-TA.II.
5. **Endgame** — create up to 3 products simultaneously, maintain upgrades.

## Divisions
- **Tobacco Division** (`TOBACCO_DIV`): primary division, best early industry for investment rounds.
- **Agriculture Division** (`AGRI_DIV`): early revenue support.

## Office Sizes by Phase
| Phase | Size |
|-------|------|
| Early (before R1) | 9 |
| After Round 1 | 30 |
| After Round 2 | 60 |
| Endgame | 60 |

## Product Investment
- Design and marketing each receive `PRODUCT_DESIGN_BUDGET_RATIO` (10%) of available funds.
- Minimum `PRODUCT_MIN_INVEST` (1 B), maximum `PRODUCT_MAX_INVEST` (1 T).
- Always launch new products to fill the 3-product slot.

## Morale & Energy
- Apply tea and parties every loop to keep morale and energy at maximum.
- Never skip this — low morale significantly reduces production.

## Corp Upgrades
Defined in `CORP_UPGRADES` list. Always keep these as high as budget allows. Do not add or remove entries without understanding the production model.

## Exports
- `getCorpStatus(ns)`: returns a status object for `manager_gui.js` to display in the Corp tab. Keep this function lean — only read, never modify corp state from it.

## Loop
- `LOOP_MS = 5000` ms (module-level constant).
