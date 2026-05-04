---
description: "Use when working on manager_gang.js. Contains gang logic, ascension thresholds, territory warfare rules, and mode flags."
applyTo: "manager_gang.js"
---

# manager_gang.js — Gang Manager

## Purpose
Manages gang members: assigns tasks, handles ascension, purchases equipment, and controls territory warfare. Only runs if `ns.gang.inGang()` returns `true` (checked at startup — exit with `ns.tprint` + return if not in a gang or API unavailable).

## Gang Type Support
- Gang type (`isHackingGang`) is detected once at startup via `ns.gang.getGangInformation().isHacking`.
- All task names are derived from this flag — never hardcode hacking-gang task names:

| Purpose | Hacking gang | Combat gang |
|---|---|---|
| Train | `Train Hacking` | `Train Combat` |
| Wanted reduction | `Ethical Hacking` | `Vigilante Justice` |
| Money | `Money Laundering` | `Human Trafficking` |
| Respect | `Cyberterrorism` | `Terrorism` |

- Training threshold uses `stats.hack` for hacking gangs, `combatScore(stats)` for combat gangs.
- Ascension for non-warriors uses hack mult on hacking gangs, combat mults on combat gangs.
- Equipment selection always uses `combatEquipments` for combat gangs.

## Config (read from main_manager_config.js every loop)
```
services.gang.autoAscend          – automatically ascend members (default: true)
services.gang.autoEquipment       – automatically buy equipment (default: true)
services.gang.autoTerritoryWarfare – enable/disable warfare control (default: true)
services.gang.prepCombatMode       – focus on combat stat prep (default: false)
services.gang.powerFarmMode        – focus on gang power farming (default: false)
services.gang.respectFarmMode      – focus on respect farming (default: false)
```

## Ascension Thresholds
| Constant | Value | Purpose |
|----------|-------|---------|
| `ascensionFactor` | 1.8 | Hack stat multiplier must improve by this factor to trigger ascension |
| `combatAscendFactor` | 1.35 | Combat stat multiplier threshold for war-focused members |

- Only ascend if the multiplier gain exceeds the threshold — lower values lead to more frequent, less impactful ascensions.

## Territory Warfare
- Enable warfare when average win chance ≥ `startWarChance` (0.60).
- Disable warfare when average win chance < `stopWarChance` (0.52).
- The hysteresis between start/stop prevents rapid toggling.
- `autoTerritoryWarfare` flag in config must be true for the manager to touch warfare settings.

## Equipment Purchase
- Only buy equipment when `maxAmortizationHours` (4 h) payoff condition is met.
- Always keep at least `moneyBuffer` (10 M) cash after purchase.

## Dynamic Cyberterrorism Threshold
- Starts at `minRespectForCyberterrorismMin` (12.5 M).
- Rises by factor `respectRaiseFactor` (1.2) when the wanted situation is stable.
- Falls by factor `respectLowerFactor` (0.9) when wanted is rising.
- Adjusts every `respectAdjustEveryLoops` (30) iterations.

## Task Assignment Priority (per member, each loop)
1. **Warriors** (Territory Warfare / prepCombat group) → `Territory Warfare` or `Train Combat`
2. **Untrained** (below `minHackForCrime`) → `trainTask`
3. **PRIORITY 2 – Wanted cleanup** (penalty-based, never `wantedLevelGain`-based):
   - `wantedPenalty < 0.90` → 50% on `wantedRedTask`
   - `wantedPenalty < 0.80` → 70% on `wantedRedTask`
   - `wantedPenalty < 0.70` → 100% on `wantedRedTask`
   - **Do NOT use `wantedLevelGain > 0` as trigger** — respect/money tasks always generate wanted naturally.
4. **PRIORITY 3+4 – Respect farming vs Money** (when `respectFarmMode` or below respect threshold):
   - Front slice (cleaners, only when `farmCleaningActive`): `respectFarmCleanerShare` (15%) on `wantedRedTask`
   - Back slice (always): `moneyShare` (30%) on `moneyTask`
   - Middle: `respectTask`
   - `farmCleaningActive` activates at `wantedPenalty < 0.97` (-3%), deactivates at `≥ 0.99` (-1%) — hysteresis prevents oscillation.
5. **Default** → `moneyTask`

## Respect Farm Mode Member Split (example: 12 trained members)
| Condition | Cleaners | Respect | Money |
|---|---|---|---|
| penalty ≥ -1% | 0 | 8 | 4 |
| penalty -1% to -3% | 0 | 8 | 4 |
| penalty < -3% | 2 | 6 | 4 |

## Exclusive Modes
- `powerFarmMode`, `respectFarmMode`, and `prepCombatMode` are mutually exclusive — later entries in the config override earlier ones. Document any priority changes explicitly.

## Loop Delay
- `loopDelayMs = 2000` ms — read from config `services.gang.loopMs` if present, otherwise hardcoded fallback.
- Status output prints every `prepStatusEveryLoops` (5) loops to avoid log spam.
