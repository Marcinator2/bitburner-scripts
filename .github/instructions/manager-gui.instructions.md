---
description: "Use when working on manager_gui.js. Contains React GUI structure, tab layout, service toggle logic, and corp/karma imports."
applyTo: "manager_gui.js"
---

# manager_gui.js — Main GUI

## Purpose
React-based overlay GUI for controlling all services, training settings, server admin, gang, augments, corp, and IPvGO. Refreshes every `REFRESH_MS` (1000 ms).

## Key Constants (module-level — exception, shared by many helpers)
| Constant | Value | Purpose |
|----------|-------|---------|
| `PANEL_ID` | `"bitburner-main-manager-gui"` | DOM element ID to prevent duplicate panels |
| `REFRESH_MS` | 1000 | Re-render interval in ms |
| `CONFIG_FILE` | `"main_manager_config.js"` | Config file read/written on every toggle |
| `RAM_OPTIONS` | `[8, 16, ..., 1048576]` | Valid RAM values for server buy/upgrade |

## Tabs
| Tab ID | Content |
|--------|---------|
| `services` | Start/stop toggles for all services |
| `training` | combatTrainer stat selection, negativeKarma, crime |
| `gang` | Gang mode flags |
| `augments` | Augment category filter |
| `server` | Buy / upgrade purchased servers |
| `corporation` | Corp status from `getCorpStatus()` |
| `ipvgo` | IPvGO opponent/board config |

## Service Assignment to Tabs
`getServiceTab(key)` maps service keys to tab IDs. New services must be added here.

## Controls per Service (non-compact rows)
| Service key | Controls builder | Config written |
|-------------|-----------------|----------------|
| `combatTrainer` | `buildCombatStatControls()` | `services.combatTrainer.stats`, `.focus` |
| `gang` | `buildGangControls()` | `services.gang.*` flags |
| `augments` | `buildAugmentControls()` | `services.augments.categories.*`, `.repFarming` |
| `ipvgo` | `buildIpvgoControls()` | `services.ipvgo.opponent`, `.boardSize` |
| `corporation` | `buildCorpControls()` | `services.corporation.autoInvest`, `.autoGoPublic` |

## Controls in Compact Rows (services tab)
- `programs` (Buy Programs): `buildProgramsControls()` — checkbox `services.programs.build`.
- Compact rows normally have no extra controls. `programs` is the exception; add its controls inside the `isCompact` branch.

## Config Writes
- `getCorpStatus(ns)` from `manager_corporation.js` — displayed in Corp tab.
- `getBestKarmaCrime(ns)` from `manager_karma.js` — displayed in Training tab.
- `normalizeUniversityCourse(...)` from `training_location_utils.js` — for charisma course display.

## Config Writes
- Every toggle, checkbox, or RAM change writes directly to `main_manager_config.js` via `ns.write`.
- Always read the current config first (`ns.read` → `JSON.parse`), update only the changed field, then write back.
- Do not overwrite unrelated config fields.

## Server Admin Panel
- Separate RAM selectors for **buy** (`buyRam`) and **upgrade** (`upgradeRam`).
- Live cost preview before confirming an action.
- Upgrade calls `upgrade_Server.js` with `skipPrompt=true` to avoid an interactive dialog.
- `autoBuy` and `autoUpgrade` checkboxes — settings saved under `config.gui.managerGui` and also acted on by `main_manager.js` without the GUI.
