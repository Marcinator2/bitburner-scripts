# bitburner

Project overview for the Bitburner scripts in this repository. This README documents responsibilities, dependencies, and operating rules so that future changes remain traceable.

## Purpose

This repository is not a single script but a small script system with three layers:

1. `main_manager.js` as the central supervisor (or alternatively `manager_gui.js` as an in-game GUI front-end).
2. Multiple managers for specific domains such as Hacking, Stocks, Gang, Hacknet, IPvGO, Augments, and Player Stats.
3. Small worker and utility scripts that managers start or that can be executed for one-off tasks.

The primary entry point for daily operation is `main_manager.js` together with `main_manager_config.js`.

## Architecture

### 1. Supervisor layer

`main_manager.js`
- reads `main_manager_config.js`
- starts and monitors individual services via `ns.exec(...)`
- separates activation (`enabled`), runtime parameters (`args`) and the start loop (`loopMs`)
- uses `runtime_file_utils.js` (`ensureJsonFile`) to create or repair the config file on first run

Known services:
- `hack` -> `auto-hack-manager.js`
- `hacknet` -> `manager_hacknet.js`
- `stocks` -> `manager_stocks.js`
- `gang` -> `manager_gang.js`
- `negativeKarma` -> `manager_karma.js`
- `crime` -> `manager_crime.js`
- `programs` -> `auto-leveler.js`
- `combatTrainer` -> `combat_stat_trainer.js`
- `augments` -> `manager_augments.js`
- `backdoor` -> `manager_backdoor.js`
- `ipvgo` -> `manager_ipvgo.js`
- `playerStatsWorker` -> `player_stats_worker.js`
- `playerStatsView` -> `player_stats.js`
- `overview` -> `overview.js`

`manager_gui.js`
- alternative front-end to `main_manager.js`
- renders a draggable in-game HTML panel with toggle buttons for every service
- also provides quick-access buttons for buying/upgrading servers and viewing server lists
- reads and writes `main_manager_config.js`; imports helpers from `runtime_file_utils.js`, `manager_karma.js`, and `training_location_utils.js`
- can start/stop `main_manager.js` directly from the panel

### 2. Manager layer

`auto-hack-manager.js`
- scans the network via BFS
- attempts to obtain root access on reachable servers
- distinguishes between targets and runners
- deploys `v_hack.js`, `v_grow.js`, `v_weaken.js` in HWGW batches to available hosts
- reserves RAM deliberately on `home` and on purchased `MyServer_*` hosts
- starts `share-ram.js` on runners with spare RAM
- optionally buys port-opener programs via Singularity API (SF4)

`manager_stocks.js`
- trades stocks using the Stock API
- uses forecast and volatility for buy/sell decisions
- is an independent manager (not a subprocess of the hack manager)

`manager_gang.js`
- manages gang members, tasks, equipment and territory warfare behavior
- supports a combat-prep mode to train DEX/AGI before regular tasks
- dynamically adjusts respect threshold for Cyberterrorism
- functions as an autonomous subsystem rather than a small helper

`manager_hacknet.js`
- evaluates upgrade options for Hacknet nodes using a simple ROI heuristic
- purchases or upgrades nodes if the API is available and funds allow

`manager_karma.js`
- farms negative karma via the Singularity crime API
- picks the best crime by karma/s and requires ≥90% crime success chance
- automatically enables/disables `combat_stat_trainer.js` through the config if combat stats are too low
- requires Source-File 4 (Singularity)

`manager_crime.js`
- commits the best crime by $/s based on current player stats
- rechecks periodically and switches crime type if a better one is available
- requires Source-File 4 (Singularity)

`manager_augments.js`
- automatically buys augmentations from joined factions
- classifies augments into Hacking / Combat / Charisma / Hacknet / Bladeburner categories
- reads category toggles from `main_manager_config.js`
- does not install; only purchases
- requires Source-File 4 (Singularity)

`manager_backdoor.js`
- installs backdoors on all reachable servers via Singularity API
- uses BFS to connect-path to each target and installs in the background
- runs continuously with a 30 s pause between full passes
- requires Source-File 4 (Singularity)

`manager_ipvgo.js`
- plays IPvGO Subnet matches in an automated loop against a configurable opponent
- uses 1-ply board simulation with flood-fill territory counting
- scoring: territory gain, capture bonus, self-atari penalty, opponent-atari bonus, eye protection, center preference
- logs win/loss/draw statistics after each game
- args: `[opponent, boardSize]` (default: `"Slum Snakes"`, `7`)

`combat_stat_trainer.js`
- trains the stats selected in the config continuously
- available as a `combatTrainer` service for `main_manager.js`
- reads stat selection live from `main_manager_config.js`
- trains STR/DEF/DEX/AGI at gyms and CHARISMA at universities
- uses `training_location_utils.js` for location/cost data

`auto-leveler.js`
- buys hacking programs (BruteSSH.exe, FTPCrack.exe, etc.) from the TOR darkweb
- retries every 30 s if funds are insufficient
- controlled via the `programs` service

`manager_stats.js`
- trains combat stats automatically via the Singularity API
- standalone script; not currently wired into `main_manager.js`

### 3. Worker and utility layer

`v_hack.js`, `v_grow.js`, `v_weaken.js`
- generic workers for HWGW batch hacking
- accept a delay as the 2nd argument (used by the batch manager for precise timing)
- started by `auto-hack-manager.js`

`share-ram.js`
- shares free RAM time with `share()`
- should only run once per host; the hack manager avoids duplicate instances
- started on `MyServer_*` runners by the hack manager; ~10% of free RAM, minimum 1 thread

`player_stats_worker.js`
- periodically collects player state
- writes history as JSON to `player_stats_data.txt`

`player_stats.js`
- reads `player_stats_data.txt`
- renders trend tables and ASCII charts in a tail window

`overview.js`
- creates a one-time operational overview of income, processes, RAM and server status

`find-server.js`
- computes the connect path to a target server using BFS

`profit-check.js`
- monitoring/utility script for profit or income checks on hosts

`runtime_file_utils.js`
- shared utility module; exports `ensureJsonFile` and `cloneJson`
- `ensureJsonFile` reads a JSON config file, creates it from a fallback if missing, or repairs it if corrupted
- imported by `main_manager.js`, `manager_karma.js`, and `manager_gui.js`

`training_location_utils.js`
- shared utility module; exports gym/university location data and cost constants
- used by `combat_stat_trainer.js` and `manager_gui.js` to select optimal training locations

`buy-neuroflux.js`
- one-off script; buys as many NeuroFlux Governor levels as possible from a joined faction
- accepts an optional preferred faction and a money reserve as arguments
- requires Source-File 4 (Singularity)

`stock_manager_worker.js`
- helper that runs H/G/W workers against a fixed target (`joesguns`) on `MyServer_2`
- supports the stock manager by keeping the target server at optimal conditions

## Important workflows

### Main operation

`main_manager.js`
-> reads (or creates) `main_manager_config.js`
-> starts enabled services
-> continuously monitors whether services are running or need restarting

Alternatively, start `manager_gui.js` directly to get an in-game control panel that can start/stop `main_manager.js` and toggle individual services.

### Player stats pipeline

`player_stats_worker.js`
-> writes `player_stats_data.txt`
-> `player_stats.js` reads the same file and displays trends

The separation ensures the stats display is intentionally decoupled from data collection.

### Karma farming

`manager_karma.js`
-> checks combat stats; if too low, enables `combatTrainer` in the config
-> commits best karma crime in a loop until target karma is reached

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
- legacy/fallback alternative to `auto-hack-manager.js`

### Legacy hackworm deployment

`launch-hackworm.js`
-> buys or reuses a dedicated `hackworm-host` server (16 GB)
-> copies `1st-hackworm.js` + workers there and starts it

## File groups

### Core files

- `main_manager.js`
- `main_manager_config.js`
- `README.md`

### GUI

- `manager_gui.js`

### Hacking

- `auto-hack-manager.js`
- `money-hack.js`
- `hack-worker.js` *(legacy)*
- `1st-hackworm.js` *(legacy)*
- `launch-hackworm.js` *(legacy helper)*
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

### Singularity services (SF4)

- `manager_karma.js`
- `manager_crime.js`
- `manager_augments.js`
- `manager_backdoor.js`
- `buy-neuroflux.js`
- `auto-leveler.js`

### IPvGO

- `manager_ipvgo.js`

### Server management & admin

- `new_server_buy.js`
- `new_server_setup.js`
- `upgrade_Server.js`
- `umbenennen_server.js`

### Shared utilities

- `runtime_file_utils.js`
- `training_location_utils.js`

### Monitoring & experiments

- `overview.js`
- `find-server.js`
- `profit-check.js`
- `befehltest.js`
- `scp_kopieren.js`
- `test.js`

## Configuration and data

- `main_manager_config.js` is the active runtime config. `main_manager.js` and `manager_gui.js` both read from and write to this file. It is created automatically on first run if missing.
- `main_manager_config.txt` is an older copy of the config that may still exist in-game; it is no longer the primary file.
- `player_stats_data.txt` is written by `player_stats_worker.js` at runtime.
- Runtime data files do not need to be pushed from the VS Code workspace into Bitburner; scripts create or repair them in-game as needed.

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

