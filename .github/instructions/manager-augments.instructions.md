---
description: "Use when working on manager_augments.js. Contains augment category filtering, faction rep selection, and purchase logic."
applyTo: "manager_augments.js"
---

# manager_augments.js — Augment Manager

## Purpose
Automatically purchases augmentations from player's factions, filtered by category. Requires Source-File 4 (Singularity API).

## API Guard
- Check `ns.singularity && typeof ns.singularity.getAugmentationsFromFaction === "function"`.
- Exit with `ns.tprint("ERROR: Singularity API not available.")` + `return`.

## Config (read from main_manager_config.js)
```
services.augments.categories.hacking     – buy hacking augments (default: true)
services.augments.categories.combat      – buy combat augments (default: true)
services.augments.categories.hacknet     – buy hacknet augments (default: false)
services.augments.categories.bladeburner – buy bladeburner augments (default: false)
services.augments.categories.charisma    – buy charisma augments (default: false)
services.augments.minMoneyBuffer         – minimum cash to keep (default: 0)
services.augments.repFarming             – focus on rep gain instead of buying (default: false)
```

## Augment Classification
`classifyAugment(stats)` maps augment stat fields to categories:
- `HACKING_FIELDS` → `"hacking"`
- `COMBAT_FIELDS` → `"combat"` (includes crime_money and crime_success)
- `CHARISMA_FIELDS` → `"charisma"` (includes faction_rep and work_money)
- `hacknet_*` → `"hacknet"`
- `bladeburner_*` → `"bladeburner"`

An augment can belong to multiple categories. It is purchased if **any** of its categories is enabled.

## Faction Selection per Augment
- For each affordable, unowned augment: find the faction among player's current factions with the highest rep.
- Only buy if the player has enough rep in at least one faction.

## NeuroFlux Governor
- `NEUROFLUX` constant: never included in normal augment loop — use `buy-neuroflux.js` for that.

## Purchase Order
- Always buy from highest to lowest cost to avoid the exponential price increase from cheaper augments.
