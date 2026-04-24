---
description: "Use when working on combat_stat_trainer.js. Contains stat selection logic, gym/university routing, and config integration."
applyTo: "combat_stat_trainer.js"
---

# combat_stat_trainer.js — Stat Trainer

## Purpose
Trains player combat stats (STR/DEF/DEX/AGI via gym, Charisma via university) based on a selection read from `main_manager_config.js`. Can be run standalone or started by `manager_karma.js` as a sub-service.

## API Guard
- Requires `ns.singularity` — exit with `ns.tprint("Error: Singularity API not available. Requires Source-File 4.")` + `return`.

## Config (read from main_manager_config.js every loop)
```
services.combatTrainer.stats.strength   – train strength (bool)
services.combatTrainer.stats.defense    – train defense (bool)
services.combatTrainer.stats.dexterity  – train dexterity (bool)
services.combatTrainer.stats.agility    – train agility (bool)
services.combatTrainer.stats.charisma   – train charisma (bool)
services.combatTrainer.charismaCourse   – university course name (default: "Leadership")
services.combatTrainer.focus            – use focus (default: false)
```

## Stat Routing
| Stat | Method |
|------|--------|
| strength, defense, dexterity, agility | `ns.singularity.gymWorkout(gym, stat)` |
| charisma | `ns.singularity.universityCourse(university, course)` |

## Stat Selection (pickNextStat)
- Compares current skill values for all selected stats.
- Trains the stat with the **lowest current value** to keep stats balanced.

## Location Resolution
- Imports from `training_location_utils.js`: `selectBestGym()`, `selectBestUniversity()`, `getConfiguredLocation()`, `normalizeUniversityCourse()`.
- `normalizeUniversityCourse()` maps any string (including old gym names or invalid values) to a valid university course — prevents `singularity.universityCourse` from crashing on bad input.
- City travel is handled automatically if the player is in the wrong city.

## SERVICE_KEY
- `SERVICE_KEY = "combatTrainer"` — used when writing back to the config (e.g. when `manager_karma.js` enables this trainer for a specific stat set).

## When No Stats Are Selected
- Stop the current action and wait — do not crash or loop endlessly.
- Print `"No combat stats selected. Waiting for change..."` via `ns.print`.

## CHECK_INTERVAL_MS
- `15 000` ms between stat evaluations.
