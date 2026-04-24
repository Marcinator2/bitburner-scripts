---
description: "Use when working on auto-leveler.js. Contains program purchase logic, build fallback, and config integration."
applyTo: "auto-leveler.js"
---

# auto-leveler.js — Buy Programs

## Purpose
Automatically purchases all hacking programs (BruteSSH.exe, FTPCrack.exe, etc.) once per hour.
Optionally builds (codes) programs via Singularity API when not enough money to buy.
Requires Source-File 4 (Singularity API).

## Config (read from main_manager_config.js)
```
services.programs.build  – if true, code programs via createProgram() when purchase fails (default: false)
```

Config is re-read at the start of every hourly cycle (not at module level).

## Program List
Fixed list in order: BruteSSH, FTPCrack, relaySMTP, HTTPWorm, DeepscanV1, DeepscanV2, AutoLink, ServerProfiler, SQLInject, Formulas.

## Loop
- Cycle interval: 1 hour (`hourMs = 60 * 60 * 1000`).
- Retry delay when not enough money: 30s (`retryDelay = 30000`).
- Purchases TOR router first via `ns.singularity.purchaseTor()`.

## Buy vs Build Logic
1. Try `purchaseProgram()` first.
2. If purchase fails and `build === true`: call `createProgram(program, false)` and wait for completion (polls every 5s).
3. If `build === false`: just retry after `retryDelay`.
4. Singularity API unavailable → skip program silently.
