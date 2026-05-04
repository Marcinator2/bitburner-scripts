---
description: "Use when working on bootstrap.js. Contains phase logic, hacking study course selection, and hacknet income integration."
applyTo: "bootstrap.js"
---

# bootstrap.js — Fresh-Start Launcher

## Purpose
Phase-based launcher for a fresh start on a home server with 8 GB RAM.
Runs in a loop (every 10 s) and terminates automatically once `main_manager.js` is running.

## Phase Overview
- **Phase 1a** – Study best affordable hack course at Rothman University (SF4 only, idle only)
- **Phase 1c** – Start `money-hack.js` targeting `n00dles` if no hacking script is running
- **Phase 1d** – Buy first hacknet node if none exist
- **Phase 2** – Launch `auto-leveler.js` + `manager_hacknet.js` (SF4 only)
- **Phase 3** – Launch `auto-hack-manager.js` (≥ 8 GB free) + `manager_server.js` (≥ 4 GB free)
- **Phase 4** – Self-terminate once `main_manager.js` is running

## Phase 1a – Hacking Study
- Requires SF4 (Singularity API).
- Never interrupts non-study work (e.g. faction work); only acts when `getCurrentWork() === null` or when a lower-tier hack course is running.
- University: **Rothman University** (Sector-12), `focus = false`.
- Course selection is driven by current **hacknet total production ($/s)**:

| Hacknet $/s | Course name (ns arg)       | classType string  | Cost/s |
|-------------|----------------------------|-------------------|--------|
| ≥ 960       | `"Algorithms"`             | `"Algorithms"`    | 960    |
| ≥ 240       | `"Networks"`               | `"Networks"`      | 240    |
| ≥ 120       | `"Data Structures"`        | `"Data Structures"`| 120   |
| < 120       | `"Study Computer Science"` | `"Computer Science"`| 0    |

- Course upgrades automatically when hacknet income grows (switches on next loop tick).
- Without SF4: print a hint, do not attempt to call Singularity APIs.

## Phase 3 – RAM Thresholds
- `auto-hack-manager.js` starts when `homeRam >= 8` and enough free RAM.
- Before starting `auto-hack-manager.js`, kill `money-hack.js` and `await ns.sleep(500)`.
- `manager_server.js` starts when `homeRam >= 4` and enough free RAM.

## Loop Interval
`LOOP_MS = 10_000` (10 seconds). Always ends with `await ns.sleep(LOOP_MS)`.

## Self-Termination
Checked **first** in the loop: if `main_manager.js` is running on home, print a message and `return`.
