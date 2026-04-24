---
description: "Use when working on manager_crime.js or manager_karma.js. Contains crime selection logic, karma vs money focus, and combat trainer integration."
applyTo: "manager_crime.js, manager_karma.js"
---

# manager_crime.js & manager_karma.js — Crime Managers

These two scripts are **independent** and serve different goals.

## manager_crime.js — Money Focus
- Selects the best crime by **effective $/s** = `moneyPerSec × chance` (chance-weighted).
- No minimum chance requirement — pure $/s optimization.
- Rechecks every `CHECK_INTERVAL_MS` (10 000 ms) and switches crime if a better one is found.
- `CRIME_FOCUS = false` — does not monopolize player focus.
- Displays top 5 crimes in the tail log.

## manager_karma.js — Karma Focus
- Selects the best crime by **karma/s**.
- Requires crime chance ≥ `CRIME_CHANCE_TARGET` (0.90 = 90%) before committing.
- **If chance < 90%**: enables `combat_stat_trainer.js` for the relevant stats (writes to config) and stops the current crime action instead.
- **If chance ≥ 90%**: disables the managed combat trainer and commits the crime.
- Rechecks every `CHECK_INTERVAL_MS` (15 000 ms).
- `CRIME_FOCUS = false`.

## atExit Hook (manager_karma.js only)
- Registers `ns.atExit()` to call `disableManagedCombatTrainer()` when the script terminates.
- This ensures the trainer is not left running after karma farming stops.
- Always keep this `atExit` registration in place.

## Shared Constants
- `CRIME_TYPES`: full list of all available crimes — do not add non-existent crime names.
- `TRAINABLE_STATS`: `["strength", "defense", "dexterity", "agility", "charisma"]`.

## API Guard (both scripts)
- Require `ns.singularity` — exit with `ns.tprint(...)` + `return` if missing.

## Do Not Merge
These two scripts must remain separate. `manager_crime.js` focuses on $/s (no chance floor), `manager_karma.js` focuses on karma/s (with chance floor and trainer fallback). Their logic is intentionally different.
