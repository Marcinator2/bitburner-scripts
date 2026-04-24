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
`classifyAugment(stats)` maps augment stat fields to categories via `else if` per key — a key can only land in one category:
- `hacknet_*` → `"hacknet"` (checked first to prevent overlap with hacking)
- `bladeburner_*` → `"bladeburner"`
- `HACKING_FIELDS` → `"hacking"`
- `COMBAT_FIELDS` → `"combat"` (includes crime_money and crime_success)
- `CHARISMA_FIELDS` → `"charisma"` (includes faction_rep and work_money)

An augment as a whole can belong to multiple categories (e.g. hacking + combat) if it has keys from both sets. It is purchased if **any** of its categories is enabled.
Hacknet augments are never counted as hacking augments.

## Faction Selection per Augment
- For each unowned augment: find the faction where the rep gap (`repReq - factionRep`, min 0) is **smallest** — i.e. the faction where the augment unlocks soonest.
- Tiebreaker when gap is equal: prefer the faction with the higher current rep.
- Only buy if the player has enough rep in at least one faction.

## NeuroFlux Governor
- `NEUROFLUX` constant: never included in normal augment loop — use `buy-neuroflux.js` for that.

## Purchase Order
- Always buy from highest to lowest cost to avoid the exponential price increase from cheaper augments.
