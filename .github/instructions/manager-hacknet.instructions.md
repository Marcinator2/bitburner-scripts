---
description: "Use when working on manager_hacknet.js. Contains hacknet upgrade ROI logic and budget constants."
applyTo: "manager_hacknet.js"
---

# manager_hacknet.js — Hacknet Manager

## Purpose
Automatically purchases and upgrades Hacknet nodes based on best production-per-dollar return.

## API Guard
- Check `ns.hacknet && typeof ns.hacknet.numNodes === "function"` at startup.
- On failure: `ns.tprint("Error: ns.hacknet API not available.")` + `return`.
  (Current code exits silently — update to follow project guidelines when touching this file.)

## Key Constants (inside main)
| Constant | Default | Purpose |
|----------|---------|---------|
| `reserveCash` | 0 | Fixed amount to keep in $ before spending |
| `minAffordableMargin` | 0 | Additional buffer on top of `reserveCash` |
| `loopDelayMs` | 30 ms | Pause between upgrade passes |

## Upgrade Decision Logic
For each possible action (buy node, upgrade level/RAM/cores of existing nodes):
- Calculate the estimated production delta (`deltaProd`).
- Calculate cost.
- Sort by `deltaProd / cost` (best ROI first).
- Buy the best affordable option each pass.

## Average Production Estimate
When no nodes exist yet, `avgProd` defaults to `0.1` to allow the first node purchase to be evaluated.

## Loop Delay Note
`loopDelayMs = 30` ms is intentionally very short — hacknet upgrades are cheap and frequent early game. Increase this if it causes performance issues.
