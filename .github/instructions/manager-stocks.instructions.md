---
description: "Use when working on manager_stocks.js or stock_manager_worker.js. Contains stock trading logic, money thresholds, and worker integration."
applyTo: "manager_stocks.js, stock_manager_worker.js"
---

# manager_stocks.js — Stock Manager

## Purpose
Automated stock trading. Buys when server money is below `pct_MinMoney` of max, sells when above `pct_MaxMoney`. Also manages hack/grow/weaken workers on the target server to manipulate money levels.

## API Guard
- Requires WSE/TIX API access (`ns.stock`).
- Exit with `ns.tprint(...)` + `return` if neither `buyStock`, `purchaseTixApi`, nor `hasTixApiAccess` is available.

## Args
| Index | Default | Purpose |
|-------|---------|---------|
| 0 | `"joesguns"` | Target server to hack/grow for stock manipulation |
| 1 | `"JGN"` | Stock market symbol of that company |

## Key Constants (inside main)
| Constant | Value | Purpose |
|----------|-------|---------|
| `pct_MinMoney` | 0.2 | Buy stocks when server money < 20% of max |
| `pct_MaxMoney` | 0.8 | Sell stocks when server money > 80% of max |
| `ramBuffer` | 32 GB | RAM buffer to leave free on home |
| `maxBuyQuantity` | 10 B | Maximum shares to buy per transaction |
| `minCashReserve` | 10 M | Minimum cash to keep on account before buying |

## Stock API Compatibility
- Uses `getStockMethod()` helper to resolve method names across API versions (e.g. `has4SDataTixApi` vs `has4SDataTIXAPI`).
- Always use `getStockMethod()` when calling optional stock API functions — do not call directly.

## Workers
- Uses `v_hack.js`, `v_grow.js`, `v_weaken.js` to manipulate server money.
- Always check that `v_weaken.js` has a valid RAM cost before starting the loop.
