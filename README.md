# bitburner

Project overview for the Bitburner scripts in this repository. This README documents responsibilities, dependencies, and operating rules so that future changes remain traceable.

## Purpose

This repository is not a single script but a small script system with three layers:

1. `main_manager.js` as the central supervisor.
2. Multiple managers for specific domains such as Hacking, Stocks, Gang, Hacknet, or Player Stats.
3. Small worker and utility scripts that managers start or that can be executed for one-off tasks.

The primary entry point for daily operation is currently `main_manager.js` together with `main_manager_config.txt`.

## Architecture

### 1. Supervisor layer

`main_manager.js`
- reads `main_manager_config.txt`
- starts and monitors individual services via `ns.exec(...)`
- separates activation (`enabled`), runtime parameters (`args`) and the start loop (`loopMs`)

Known services:
- `hack` -> `auto-hack-manager.js`
- `hacknet` -> `manager_hacknet.js`
- `stocks` -> `manager_stocks.js`
- `gang` -> `manager_gang.js`
- `programs` -> `auto-leveler.js`
- `combatTrainer` -> `combat_stat_trainer.js`
- `playerStatsWorker` -> `player_stats_worker.js`
- `playerStatsView` -> `player_stats.js`
- `overview` -> `overview.js`

### 2. Manager layer

`auto-hack-manager.js`
- scans the network via BFS
- attempts to obtain root access on reachable servers
- distinguishes between targets and runners
- deploys `v_hack.js`, `v_grow.js`, `v_weaken.js` in batches to available hosts
- reserves RAM deliberately on `home` and on purchased `MyServer_*` hosts
- additionally starts `share-ram.js` on purchased servers

`manager_stocks.js`
- trades stocks using the Stock API
- uses forecast and volatility for buy/sell decisions
- starts `v_hack.js`, `v_grow.js`, `v_weaken.js` on `home` as needed
- is an independent manager (not a subprocess of the hack manager)

`manager_gang.js`
- manages gang members, tasks, equipment and territory warfare behavior
- contains domain-specific logic and many tunables inside the script
- functions as an autonomous subsystem rather than a small helper

`manager_hacknet.js`
- evaluates upgrade options for Hacknet nodes using a simple ROI heuristic
- purchases or upgrades nodes if the API is available

`manager_stats.js`
- trains combat stats automatically via the Singularity API
- currently not integrated into `main_manager.js`, but conceptually a separate manager/trainer

`combat_stat_trainer.js`
- trains the stats selected in the config/GUI continuously
- is available as a `combatTrainer` service for `main_manager.js`
- reads its selection live from `main_manager_config.txt` instead of using fixed targets
- trains STR/DEF/DEX/AGI at gyms and CHARISMA at universities/courses

`auto-leveler.js`
- intended for automated program purchasing
- controlled via the `programs` service

### 3. Worker and utility layer

`v_hack.js`, `v_grow.js`, `v_weaken.js`
- generic workers for batch hacking
- primarily started by the hack manager and occasionally by the stock manager

`share-ram.js`
- shares free RAM time with `share()`
- used by multiple systems and thus a reusable infrastructure worker
- should only run once on each `MyServer_*` host; the hack manager will not reserve RAM for duplicate instances
- the auto-hack manager also starts it on remote runners with root access; target size is ~10% of RAM but at least 1 thread
- if even a single share thread would leave no room for H/G/W on a host, Share is not started there

`player_stats_worker.js`
- periodically collects player state
- writes history as JSON to `player_stats_data.txt`

`player_stats.js`
- reads `player_stats_data.txt`
- renders trend tables and ASCII charts in a tail window

`overview.js`
- creates a single operational overview of income, processes, RAM and server status

`find-server.js`
- computes the connect path to a target server using BFS

`profit-check.js`
- monitoring/utility script for profit or income checks on hosts

## Important workflows

### Main operation

`main_manager.js`
-> reads `main_manager_config.txt`
-> starts enabled services
-> continuously monitors whether services are running or need restarting

### Player stats pipeline

`player_stats_worker.js`
-> writes `player_stats_data.txt`
-> `player_stats.js` reads the same file and displays trends

The separation ensures the stats display is intentionally decoupled from data collection.

### Server purchase and provisioning

`new_server_buy.js`
-> purchases a new `MyServer_*`
-> starts `new_server_setup.js`

`new_server_setup.js`
-> copies several scripts to the new server
-> starts `profit-check.js` there
-> starts `manager_share-ram.js` there

`manager_share-ram.js`
-> starts `share-ram.js` on the target host

### Direct single-host hack

`money-hack.js`
- a simpler direct hack/grow/weaken loop for a single target host
- is an older or alternative path compared to `auto-hack-manager.js`

## File groups

### Core files

- `main_manager.js`
- `main_manager_config.txt`
- `README.md`

### Hacking

- `auto-hack-manager.js`
- `money-hack.js`
- `hack-worker.js`
- `1st-hackworm.js`
- `v_hack.js`
- `v_grow.js`
- `v_weaken.js`
- `share-ram.js`
- `manager_share-ram.js`

### Stocks

- `manager_stocks.js`
- `stock_manager_worker.js`

### Player & Combat Stats

- `player_stats_worker.js`
- `player_stats.js`
- `manager_stats.js`
- `combat_stat_trainer.js`

### Gang & Hacknet

- `manager_gang.js`
- `manager_hacknet.js`

### Server management & admin

- `new_server_buy.js`
- `new_server_setup.js`
- `upgrade_Server.js`
- `umbenennen_server.js`

### Utilities & experiments

- `overview.js`
- `find-server.js`
- `profit-check.js`
- `befehltest.js`
- `scp_kopieren.js`
- `test.js`
- `Merkliste.txt`

## Configuration and data

Important for the VSCode Bitburner extension:
- Runtime files such as `main_manager_config.txt` and `player_stats_data.txt` do not need to be pushed from the workspace into Bitburner.
- Scripts create or repair these files in-game as needed.
- Treat these files primarily as in-game runtime artifacts, not as regular synced files.

### `main_manager_config.txt`

This file is the central control for the supervisor.

Key fields:
- `loopMs`: interval at which `main_manager.js` checks service status
- `tail`: whether the manager should open a tail window automatically
- `services`: object with per-service configuration by service key

Example service settings:
- `hack.enabled`
- `stocks.enabled`
- `gang.enabled`
- `combatTrainer.args = ["main_manager_config.txt", "Sector-12", "Powerhouse Gym", false, "Sector-12", "Rothman University", "Leadership"]`
- `combatTrainer.stats = { strength, defense, dexterity, agility, charisma }`
- `playerStatsWorker.args = ["player_stats_data.txt", 10000, 360]`

### `player_stats_data.txt`

Created at runtime and contains JSON roughly matching:
- `version`
- `sampleMs`
- `maxSamples`
- `samples[]`

This file is a runtime data store, not a hand-edited artifact.

## Maturity estimate

### Actively used core components

- `main_manager.js`
- `auto-hack-manager.js`
- `player_stats_worker.js`
- `player_stats.js`
- `manager_stocks.js`
- `manager_gang.js`

### Optional or feature-gated

- `manager_hacknet.js` – useful only if the Hacknet API is available
- `manager_stats.js` – requires Singularity / Source-File 4
- `auto-leveler.js` – depends on available APIs and game progress

### Likely experimental, old or unclear

- `1st-hackworm.js`
- `hack-worker.js`
- `befehltest.js`
- `scp_kopieren.js`
- `test.js`

These files should be reviewed before major refactors to avoid missing hidden dependencies.

## Cleanup categories

Going forward, separate the repo into four conceptual classes.

### A. Production – actively maintained

Files in current production that should be prioritized when changing:

- `main_manager.js`
- `main_manager_config.txt`
- `auto-hack-manager.js`
- `v_hack.js`
- `v_grow.js`
- `v_weaken.js`
- `share-ram.js`
- `manager_stocks.js`
- `manager_gang.js`
- `manager_hacknet.js`
- `player_stats_worker.js`
- `player_stats.js`
- `overview.js`
- `new_server_buy.js`
- `new_server_setup.js`
- `manager_share-ram.js`
- `find-server.js`

### B. Production but specialized or single-purpose

Useful files that are not the central architecture backbone:

- `money-hack.js`
- `profit-check.js`
- `combat_stat_trainer.js`
- `manager_stats.js`
- `upgrade_Server.js`
- `umbenennen_server.js`

### C. Legacy (keep but do not use as main path)

These files remain for historical reasons but should not be the default path for new features:

- `1st-hackworm.js`
- `hack-worker.js`

Rule:
- When extending hacking, prefer `auto-hack-manager.js` + `v_*` workers.
- Only modify legacy files deliberately when comparing or repairing old flows.

### D. Experimental / scratch / duplicate

Files considered non-productive for now:

- `befehltest.js`
- `scp_kopieren.js`
- `test.js`

Rules:
- Do not implement new logic in these files.
- If valuable logic exists here, move it into a production file and archive or remove the remainder later.

## Concrete cleanup rules

To avoid mixing production and experimental code, follow these rules:

1. Add new features only to production classes A or B.
2. Do not use legacy class C files as templates for new managers.
3. Treat class D files as reference only; do not extend them.
4. If you need code from class D, port it to a production file first and integrate it cleanly.
5. Avoid duplicate logic: use `find-server.js` for server paths and `auto-hack-manager.js` + `v_*` workers for batch hacking.

## Next sensible cleanup steps

If we proceed with cleanup, the recommended order is:

1. Align `test.js` with `find-server.js` and then archive or delete.
2. Compare `1st-hackworm.js` and `hack-worker.js` against the current hacking flow and decide whether they still serve a purpose.
3. Move `befehltest.js` and `scp_kopieren.js` into a clear archive/scratch area or remove them.

## Guidelines for future changes

### 1. Keep entry points clear

Prefer a single entry point for new automations:
- globally via `main_manager.js`
- domain-specific via a dedicated manager
- technically via small workers

### 2. Separate configuration from logic

Frequently changed values should be configuration, not hard-coded in loops. This applies to:
- activation flags
- timing values
- money and RAM reserves
- thresholds for buying, selling or training

### 3. Do not duplicate shared workers

`v_*` workers and `share-ram.js` are shared infrastructure. When changing them, consider:
- hack manager
- stock manager
- provisioning of new servers

### 4. Keep data flows explicit

If a script writes a file, document at least:
- which file is written
- what format is expected
- who reads the file later

The player stats pipeline is the cleanest example of this approach.

### 5. Avoid mixing old and new flows unnoticed

The repo contains both a newer manager/worker style and older single scripts. Before extending, choose the preferred path.

Practically:
- add new hacking logic to `auto-hack-manager.js` + `v_*` workers
- keep `money-hack.js` and older scripts only if they have a clear purpose

### 6. Respect script naming conventions

Recommended meaning:
- `main_*` = global entrypoint
- `manager_*` = long-running domain manager
- `*_worker` or `v_*` = small, targeted execution unit
- utility scripts for single, well-defined tasks only

## Recommended start commands

For normal operation:
- `run main_manager.js`
- `run manager_gui.js` for a GUI panel with buttons to enable/disable services

For one-off status checks:
- `run main_manager.js status`
- `run main_manager.js once`

For single tools:
- `run find-server.js n00dles`
- `run player_stats.js player_stats_data.txt once`

## Manager GUI

There is now a first GUI path via `manager_gui.js`.

Funktionen:
- Start/Stop for `main_manager.js`
- Button per service to enable or disable
- Display of config status, runtime status and script availability
- Window is draggable via the header
- Window can be hidden via `Hide` and shown again via a floating button
- Server admin area with buttons for `new_server_buy.js` and `upgrade_Server.js`
- Separate RAM selection for buy and upgrade directly in the GUI
- Live cost display for buy and upgrade directly in the GUI
- Upgrade confirmation directly in the GUI instead of via `ns.prompt`, when started via the panel
- RAM selection goes up to `2^20` = `1048576 GB`
- Last selected GUI settings for buy/upgrade and window position are saved
- Open upgrade confirmation state is cleanly reset on relevant GUI changes
- Stat-Trainer shows active stats and combat/charisma training locations directly in the GUI

Note on the Combat Trainer:
Note on the Stat Trainer:
- In the GUI there are checkboxes for STR, DEF, DEX, AGI and CHA.
- The trainer continues running with the currently enabled stats until you change the selection.
- Combat stats use `combatCity` plus gym, charisma uses `charismaCity` plus university/course from `services.combatTrainer.args`.

Important:
- The GUI writes directly to `main_manager_config.txt`.
- When disabling, the respective script process is stopped immediately.
- When enabling, the main manager is started if it is not already running.

Limitation:
- The GUI uses DOM access of the Bitburner interface. If this environment is ever unavailable, a prompt-based menu would be the more robust fallback.

## Open questions for later

- Should `manager_stats.js` be included in the central `main_manager.js`?
- Which old hacking scripts are still productively relevant and which can be archived?
- Should the many hard-coded constants in `manager_gang.js`, `manager_stocks.js` and `auto-hack-manager.js` gradually move into config files?
- Should there be a second doc that only collects run commands and setup sequences?

## Short summary

The project is already structured as a small automation system. The central relationship is:

`main_manager.js` orchestrates managers,
managers orchestrate workers,
and only a few scripts write persistent runtime data.

If we extend or clean up later, we should preserve this structure instead of adding new one-off paths alongside it.

