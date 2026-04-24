---
description: "Use when working on manager_gang.js. Contains gang logic, ascension thresholds, territory warfare rules, and mode flags."
applyTo: "manager_gang.js"
---

# manager_gang.js — Gang Manager

## Purpose
Manages gang members: assigns tasks, handles ascension, purchases equipment, and controls territory warfare. Only runs if `ns.gang.inGang()` returns `true` (checked at startup — exit with `ns.tprint` + return if not in a gang or API unavailable).

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

## Exclusive Modes
- `powerFarmMode`, `respectFarmMode`, and `prepCombatMode` are mutually exclusive — later entries in the config override earlier ones. Document any priority changes explicitly.

## Loop Delay
- `loopDelayMs = 2000` ms — read from config `services.gang.loopMs` if present, otherwise hardcoded fallback.
- Status output prints every `prepStatusEveryLoops` (5) loops to avoid log spam.
