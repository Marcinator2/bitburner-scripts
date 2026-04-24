---
description: "Use when working on player_stats_worker.js or player_stats.js. Contains data file format, sample lifecycle, and visualization rules."
applyTo: "player_stats_worker.js, player_stats.js"
---

# Player Stats Pipeline

## Overview
Two-script pipeline:
1. `player_stats_worker.js` — collects samples and writes them to a JSON file.
2. `player_stats.js` — reads that file and displays trends in the tail window.

## Data File Format
```json
{
  "version": 1,
  "sampleMs": 10000,
  "maxSamples": 360,
  "samples": [ ... ]
}
```
- `version`: always `1` — increment only on breaking format changes.
- `sampleMs`: interval between samples in ms.
- `maxSamples`: ring buffer size — oldest samples are dropped when exceeded.
- `samples[]`: array of snapshot objects (money, hack exp, stats, etc.).

## player_stats_worker.js — Args
| Index | Default | Purpose |
|-------|---------|---------|
| 0 | `"player_stats_data.txt"` | Output file path |
| 1 | 10 000 ms | Sample interval |
| 2 | 360 | Max samples to keep |

## Validation (at startup)
- `sampleMs` must be ≥ 1000 — exit with `ns.tprint` + `return` if not.
- `maxSamples` must be ≥ 2 — exit with `ns.tprint` + `return` if not.

## File Init
- Uses `ensureJsonFile()` from `runtime_file_utils.js` to create the file if missing.
- If the file exists but is corrupt, `loadHistory()` logs a warning and rebuilds an empty history.

## Sample Lifecycle
1. `loadHistory()` reads and parses the current file.
2. `createSample(ns)` appends the current player state.
3. Trim to `maxSamples` by splicing from the front.
4. Write back with `ns.write(..., "w")`.

## player_stats.js — Display
- Reads `player_stats_data.txt` every loop iteration.
- Shows trends (delta per sample, per hour) in the tail window using `ns.print`.
- Uses `ns.clearLog()` at the top of each loop.
- Never writes to the data file — read only.
