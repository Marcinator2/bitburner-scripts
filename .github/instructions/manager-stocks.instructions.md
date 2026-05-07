---
description: "Use when working on manager_stocks.js or stock_manager_worker.js. Contains stock trading logic, money thresholds, and worker integration."
applyTo: "manager_stocks.js, stock_manager_worker.js"
---

# manager_stocks.js — Stock Manager

## Purpose
Automated stock trading with two operating modes:
- **4S mode** (when 4S Market Data TIX API is available): multi-symbol forecast trading with regime detection, trailing stops, rotation logic, and hard stop-loss.
- **MANIP mode** (no 4S): auto-selects the best server→stock targets by efficiency score and runs a non-blocking multi-target scheduler across all available hosts.

## API Guard
- Requires WSE/TIX API access (`ns.stock`).
- Exits with `ns.tprint(...)` + `return` if neither `buyStock`, `purchaseTixApi`, nor `hasTixApiAccess` is available.

## No Script Args
All configuration is read from `main_manager_config.js` at startup. Target selection in MANIP mode is fully automatic — no args needed.

## Key Constants (inside `main`)
| Constant | Value | Purpose |
|----------|-------|---------|
| `pct_MinMoney` | 0.2 | MANIP: buy stock when server money < 20% of max |
| `pct_MaxMoney` | 0.8 | MANIP: sell stock when server money > 80% of max |
| `ramBuffer` | 32 GB | RAM buffer reserved on `home` only |
| `maxBuyQuantity` | 10 B | Max shares per transaction |
| `minCashReserve` | 10 M | Minimum cash to keep on account |
| `txFee` | 100 K | Transaction fee deducted from budget |
| `buyForecast` | 0.56 | 4S: minimum forecast to buy |
| `sellForecast` | 0.52 | 4S: forecast threshold to sell |
| `hardStopLossPct` | 0.04 | 4S: hard stop-loss at 4% below buy price |
| `trailingStopPct` | 0.10 | 4S: trailing stop at 10% below peak |
| `forecastDropExit` | 0.05 | 4S: sell if forecast dropped 5% since entry |
| `rebuyCooldownMs` | 90 s | Cooldown before re-buying a recently sold symbol |
| `stockTickMs` | from API | Market update interval (fallback: 6 s) |

## Config Fields (read from `main_manager_config.js`)
\`\`\`json
"stocks": {
  "loopMs": 2000,
  "useOwnedServers": true,
  "maxManipTargets": 2
}
\`\`\`
- `loopMs`: main loop sleep interval
- `useOwnedServers`: if true, MANIP mode distributes workers across all purchased servers and all rooted network servers (not just home)
- `maxManipTargets`: how many MANIP_TARGETS entries to use simultaneously

## MANIP Target Selection
- `MANIP_TARGETS` is a module-level constant array of `{ server, symbol, score }` entries, sorted descending by efficiency score (`mv_max / shareTxForMovement_min`).
- Top entries: `netlink/NTLK` (22.2), `joesguns/JGN` (18.3), `sigma-cosmetics/SGC` (13.8), …
- `selectManipTargets()` filters by: server exists, root access, hack level requirement met, maxMoney > 0; returns top `maxManipTargets`.
- Target list refreshes every 60 s (`MANIP_REFRESH_MS`).

## MANIP Host Distribution
- `calcAllManipHosts()` always includes `home`. If `useOwnedServers` is true, also adds `ns.cloud.getServerNames()` (purchased) and `scanRootedHosts()` (BFS over all rooted non-owned servers).
- `calcThreadsOnHost(h)`: uses `ramBuffer = 32` only for `home`, 0 for all other hosts.
- Workers are partitioned across targets by round-robin: host at index `idx` goes to target `idx % numTargets`.

## Worker Script SCP
- `ensureScriptsOnHost(h)`: copies `v_hack.js`, `v_grow.js`, `v_weaken.js` from home via `ns.scp()` if not already present. Called for every non-home host before `ns.exec()`.
- `execWorkerOnHosts(script, server, hosts)`: calls `ensureScriptsOnHost`, then executes `script` on each host with available threads.

## MANIP Phase Logic (per target)
Each target tracks `{ phase: "hack"|"grow", nextLaunchAt }`:
1. If security > minSec + 2 → run `v_weaken.js`
2. Else if `phase === "grow"` or position held → run `v_grow.js`
3. Else → run `v_hack.js`
- `nextLaunchAt` is set to `now + opTime + 200ms` to avoid re-launching before the previous batch finishes.
- Buy: when money ≤ 20% max AND phase is "hack" AND no position AND not in cooldown → `ns.stock.buyStock`.
- Sell: when money ≥ 80% max AND position held → `ns.stock.sellStock`; sets rebuy cooldown, resets phase to "hack".

## 4S Strategy (`run4SStrategy`)
- Reads all symbols, evaluates forecast + volatility per symbol.
- Regime detection (`getMarketRegime`): HOT / NORMAL / QUIET — adjusts `buyForecast`, `sellForecast`, `minVol`, `maxOpenPositions`, `allocPerSymbol`.
- Adaptive thresholds: loosens buy forecast when `noTradeCycles` is high (idle penalty).
- Rotation logic: if all slots are full, replaces worst held position with a better candidate if score ratio > 1.25 and margin > 0.0015.
- Exit conditions (checked first): stop-loss, forecast drop, trailing stop, forecast threshold.
- Tracks per-symbol: `positionPeak`, `positionEntryForecast`, `positionEntryTime`.

## Stock API Compatibility
- Uses `getStockMethod()` helper to resolve method names across API versions (e.g. `has4SDataTixApi` vs `has4SDataTIXAPI`).
- Always use `getStockMethod()` when calling optional stock API functions — do not call directly.

## Prerequisites Auto-Purchase
- `ensureStockPrerequisites()` attempts to buy TIX API and 4S Market Data TIX API automatically when affordable. Checked every 30 s (`accessCheckIntervalMs`).
