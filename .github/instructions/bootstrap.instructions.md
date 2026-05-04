---
description: "Use when working on bootstrap.js, bootstrap_study.js, or bootstrap_hacknet.js. Contains phase logic, sub-script launch rules, and RAM reserve strategy."
applyTo: "bootstrap.js, bootstrap_study.js, bootstrap_hacknet.js"
---

# bootstrap.js — Fresh-Start Launcher

## Purpose
Phase-based launcher for a fresh start on a home server with 8 GB RAM.
Runs in a loop (every 10 s) and terminates automatically once `main_manager.js` is running.

## RAM Budget
`bootstrap.js` itself: **~5.35 GB** (no hacknet API, no singularity API calls).
Sub-scripts handle heavy APIs and are only launched when enough RAM is free.

## Phase Overview
- **Phase 1c** – Start `money-hack.js` targeting `n00dles` if no hacking script is running
- **Phase 1e** – Launch `bootstrap_hacknet.js` when RAM allows (buys first hacknet node)
- **Phase 2** – SF4 only: launch `bootstrap_study.js` + `auto-leveler.js` + `manager_hacknet.js`
- **Phase 3** – Launch `auto-hack-manager.js` (≥ 8 GB total) + `manager_server.js` (≥ 4 GB total)
- **Phase 4** – Self-terminate once `main_manager.js` is running

## RAM Reserve (`hackReserve`)
Before launching any sub-script, bootstrap checks:
```
hackingActive = money-hack.js or auto-hack-manager.js is running
hackReserve   = 0 if hackingActive, else getScriptRam("money-hack.js")
canLaunch(script) = homeFreeRam - getScriptRam(script) >= hackReserve
```
This ensures `money-hack.js` can always still be started if hacking hasn't begun yet.
Exception: Phase 1c and Phase 3 use their own explicit RAM checks (not `canLaunch`).

## Sub-scripts

### bootstrap_hacknet.js (~3.6 GB)
- Persistent loop (10 s). Buys the first hacknet node when affordable.
- Self-terminates when `manager_hacknet.js` is running.
- Launched by bootstrap Phase 1e (not SF4-gated).

### bootstrap_study.js (variable — depends on SF4 level)
- Persistent loop (10 s). Studies best hack course at Rothman University.
- SF4 L3: ~6.15 GB. SF4 L1: ~43+ GB — only launched when RAM actually fits.
- Never interrupts non-study work; only switches when idle or on a lower-tier course.
- Self-terminates when `main_manager.js` is running.

## Hacking Study Course Selection (bootstrap_study.js)
- University: **Rothman University** (Sector-12), `focus = false`.
- Course selection driven by current **hacknet total production ($/s)**:

| Hacknet $/s | Course name (ns arg)       | classType string   | Cost/s |
|-------------|----------------------------|--------------------|--------|
| ≥ 960       | `"Algorithms"`             | `"Algorithms"`     | 960    |
| ≥ 240       | `"Networks"`               | `"Networks"`       | 240    |
| ≥ 120       | `"Data Structures"`        | `"Data Structures"`| 120    |
| < 120       | `"Study Computer Science"` | `"Computer Science"`| 0     |

- Upgrades automatically when hacknet income grows (next loop tick).

## Phase 3 – RAM Thresholds
- `auto-hack-manager.js` starts when `homeRam >= 8` and enough free RAM.
- Before starting `auto-hack-manager.js`, kill `money-hack.js` and `await ns.sleep(500)`.
- `manager_server.js` starts when `homeRam >= 4` and enough free RAM.

## Loop Interval
`LOOP_MS = 10_000` (10 seconds). Always ends with `await ns.sleep(LOOP_MS)`.

## Self-Termination
Checked **first** in the loop: if `main_manager.js` is running on home, print a message and `return`.
