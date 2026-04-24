---
description: "Use when working on main_manager.js. Contains supervisor logic, service lifecycle, and config structure."
applyTo: "main_manager.js"
---

# main_manager.js — Central Supervisor

## Purpose
Reads `main_manager_config.js` every loop iteration and starts/stops services based on the `enabled` flag and the service's `shouldRun()` condition. Acts as a watchdog — dead services are restarted automatically.

## Config File
- File: `main_manager_config.js` (JSON despite the `.js` extension, read via `ns.read`)
- Key fields: `loopMs`, `tail`, `services.<key>.enabled`, `services.<key>.args`
- Config is re-read every loop iteration for live reloading without restart.
- Uses `ensureJsonFile()` from `runtime_file_utils.js` to create the config if missing.

## SERVICE_DEFINITIONS Array
Each entry:
```js
{
  key: "hacknet",           // Config lookup key: services[key]
  script: "manager_hacknet.js",
  host: "home",
  threads: 1,
  enabled: false,           // Default enabled state (overridden by config)
  args: [],                 // Default args (overridden by config)
  description: "...",
  shouldRun: ns => Boolean(ns.hacknet && ...),  // Runtime API check
}
```

## Start/Stop Logic
- A service runs if: `config.services[key].enabled === true` AND `shouldRun(ns) === true`.
- If a service should run but isn't running → start it.
- If a service shouldn't run but is running → kill it.
- `shouldRun` prevents starting services whose API is not available (e.g. Gang without being in a gang).

## Adding a New Service
1. Add an entry to `SERVICE_DEFINITIONS`.
2. Add the corresponding key block to `main_manager_config.js`.
3. Add the service to `manager_gui.js`'s `SERVICES` array and assign it to the correct tab via `getServiceTab()`.

## Loop
- `loopMs` from config, fallback `DEFAULT_LOOP_MS = 5000`.
- Opens `ns.tail()` if `config.tail === true`.

## Server Admin (headless)
- `handleServerAdmin(ns, config)` is called every loop after `supervise()`.
- Reads `config.gui.managerGui.autoBuy`, `.autoUpgrade`, `.upgradeRam` (saved by GUI).
- `autoBuy`: buys 8 GB servers until the slot limit is reached.
- `autoUpgrade`: steps each server one power-of-2 toward `upgradeRam` when affordable.
- `loadConfig()` passes `gui` through so `handleServerAdmin` works without the GUI being open.

## Status Output
- `printStatus()` shows each service line via `formatServiceLine()`.
- For enabled services, `formatServiceOptions()` prints a `└` detail line with active options:
  - `combatTrainer`: active stats
  - `gang`: active mode flags
  - `augments`: active categories + repFarming
  - `programs`: Build ON/OFF
  - `ipvgo`: opponent + board size
- A `SERVER ADMIN` block is appended if `config.gui.managerGui` exists.
