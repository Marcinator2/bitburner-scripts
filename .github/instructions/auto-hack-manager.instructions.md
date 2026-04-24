---
description: "Use when working on auto-hack-manager.js or the worker scripts v_hack.js, v_grow.js, v_weaken.js. Contains HWGW batch logic, RAM management, and share-ram scaling rules."
applyTo: "auto-hack-manager.js, v_hack.js, v_grow.js, v_weaken.js"
---

# auto-hack-manager.js — HWGW Batch Manager

## Purpose
Central hacking manager. Runs HWGW (Hack-Weaken-Grow-Weaken) batches against all hackable servers using home + purchased servers + any rooted external server as runners.

## Key Constants (inside main)
| Constant | Default | Purpose |
|----------|---------|---------|
| `SHARE_QUOTA` | 0.01 | Fraction of each runner's RAM to allocate for `share-ram.js` |
| `HACK_FRACTION` | 0.99 | Max fraction of max money to drain per batch |
| `SPACING` | 200 ms | Time gap between HWGW finish timestamps within a batch |
| `HOME_RESERVE` | 45 GB | Always keep this RAM free on home for other scripts |
| `LOOP_DELAY` | 1000 ms | Manager loop interval |
| `MIN_MONEY_FRAC` | 0.85 | Server is considered ready when it has ≥ 85% of max money |
| `MAX_BATCHES_PER_CYCLE` | 300 | Hard cap on new batch starts per manager round — **do not remove** |
| `BATCH_YIELD_EVERY` | 25 | Yield `await ns.sleep(0)` after this many batch starts — **do not remove** |

## Critical: Save-Explosion Prevention
`MAX_BATCHES_PER_CYCLE` and `BATCH_YIELD_EVERY` exist to prevent the Bitburner engine from detecting an infinite loop and to avoid save-file bloat when large amounts of RAM are available. **Never remove or increase these limits without careful testing.**

## Runners vs Targets
- **Runner**: executes worker scripts. Includes home (minus HOME_RESERVE), all purchased servers, all externally rooted servers.
- **Target**: server to be hacked. Must be non-home, non-purchased, rooted, hackLevel ≤ player hack level, maxMoney > 0.

## Worker Scripts
- `v_hack.js`, `v_grow.js`, `v_weaken.js` must accept `delay` as their **2nd argument**.
- Do not change their argument signature without updating the manager accordingly.

## share-ram.js Scaling
- The manager scales running `share-ram.js` instances across all runners to maintain `SHARE_QUOTA`.
- Existing share instances on external servers (started elsewhere with 1 thread) are included in the calculation and topped up if needed.

## Server Nuking
- `tryNuke(s)` attempts to open ports and nuke the server.
- Tool files are checked via `ns.fileExists("BruteSSH.exe", "home")` etc. before calling.
- Nuke is only attempted if enough ports can be opened.
