# Bitburner Project – Copilot Instructions

This is a Bitburner automation project. All scripts run inside the Bitburner game engine (NS2/JS).
Scripts use the `ns` (NetscriptJS) API. All files are deployed into the game via the Bitburner VS Code extension.

## General Rules
- All code comments, `ns.print`/`ns.tprint` messages, and **git commit messages** must be written in **English**.
- Commit messages follow the format: `type: short description` (e.g. `feat: add build checkbox`).

---

## Architecture

- `main_manager.js` is the central supervisor; reads `main_manager_config.js` (pure JSON despite `.js` extension; contains loopMs, tail, and the services block)
- Services in `main_manager.js`: hack, hacknet, stocks, gang, negativeKarma, programs, combatTrainer, playerStatsWorker, playerStatsView, overview
- `auto-hack-manager.js` is the central hacking manager; starts v_hack.js, v_grow.js, v_weaken.js and share-ram.js
- `auto-hack-manager.js` limits batch starts per scheduler round and yields via sleep(0) regularly (prevents infinite-loop detection and save bloat)
- `auto-hack-manager.js` scales running share-ram.js instances up to the target quota
- Server provisioning: `new_server_buy.js` → `new_server_setup.js` → copies scripts, starts `profit-check.js` + `manager_share-ram.js`
- `new_server_buy.js` is also called by `main_manager.js` headlessly for autoBuy/autoUpgrade (settings from `config.gui.managerGui`)
- Player stats pipeline: `player_stats_worker.js` writes `player_stats_data.txt`; `player_stats.js` reads and visualizes it; format: `{ version, sampleMs, maxSamples, samples[] }`
- combatTrainer is config-driven: GUI checkboxes for STR/DEF/DEX/AGI/Charisma write to `services.combatTrainer.stats`; `combat_stat_trainer.js` reads this selection live
- `combat_stat_trainer.js`: STR/DEF/DEX/AGI train at gym, Charisma via universityCourse; normalizes charisma course via normalizeUniversityCourse
- `manager_gui.js` has a Server Admin panel with RAM selector for buy/upgrade, live cost display; `new_server_buy.js` and `upgrade_Server.js` accept RAM args; `upgrade_Server.js` has skipPrompt=true
- `manager_karma.js`: dedicated service for negative karma; picks best crime by Karma/s, requires at least 90% chance, trains via `combat_stat_trainer.js` if needed; `manager_gang.js` only accesses gang APIs when already in a gang
- `manager_crime.js` and `manager_karma.js` are independent: crime = $/s, karma = Karma/s with minimum chance check
- `runtime_file_utils.js`: pure library, no standalone entry; exports `cloneJson()` and `ensureJsonFile()`
- `training_location_utils.js`: pure constants library for gym/uni locations, course names, costs, stat mappings
- `bitburner-src-stable/` mirrors the stable Bitburner source; can be used locally for API, constant, and implementation research
- `README.md` contains the current project overview, pipelines, and change guidelines

---

## Script Inventory

### Hacking
- `auto-hack-manager.js` – central hacking manager
- `v_hack.js`, `v_grow.js`, `v_weaken.js` – worker scripts
- `money-hack.js` – simple hack script
- `1st-hackworm.js`, `hack-worker.js` – legacy
- `launch-hackworm.js` – buys server "hackworm-host" (16 GB), deploys 1st-hackworm.js + v_*.js

### Manager Services
- `main_manager.js` – central supervisor
- `manager_gui.js` – GUI for all services
- `manager_hacknet.js` – Hacknet automation
- `manager_stocks.js` + `stock_manager_worker.js` – stock trading
- `manager_gang.js` – gang management (only when already in a gang)
- `manager_karma.js` – negative karma via crime (Karma/s)
- `manager_crime.js` – money via crime ($/s), no karma focus
- `manager_augments.js` – buys augments filtered by category (hacking/combat/hacknet/bladeburner/charisma); requires SF4; picks faction with smallest rep gap per augment
- `manager_backdoor.js` – installs backdoors via BFS every 30s; requires SF4
- `manager_corporation.js` – fully automated corp manager (divisions, products, investment rounds, IPO); exports `getCorpStatus(ns)`
- `manager_ipvgo.js` – plays IPvGO subnet matches in a loop with opponent-specific AI strategies; args: [opponent?, boardSize?]
- `manager_stats.js` – trains combat stats automatically
- `manager_share-ram.js` – starts share-ram.js

### Player Stats
- `player_stats_worker.js` – writes JSON history to `player_stats_data.txt`
- `player_stats.js` – reads and visualizes trends in the tail window
- `combat_stat_trainer.js` – trains STR/DEF/DEX/AGI (gym) and Charisma (university) to target values

### Infrastructure
- `new_server_buy.js` – buys a server and starts new_server_setup.js; also used by main_manager.js for headless autoBuy/autoUpgrade
- `new_server_setup.js` – copies scripts, starts profit-check.js + manager_share-ram.js
- `upgrade_Server.js` – upgrades RAM of a server; args: [server, ram, skipPrompt?]
- `share-ram.js` – shares RAM with factions
- `buy-neuroflux.js` – buys NeuroFlux Governor endlessly; args: [faction?, reserveMoney?]; requires SF4
- `auto-leveler.js` – buys programs automatically (BruteSSH etc.); builds them via createProgram() if `services.programs.build = true`
- `overview.js` – monitors money-hack.js
- `profit-check.js` – helper script
- `find-server.js` – helper script

### Libraries (no standalone entry)
- `runtime_file_utils.js` – `cloneJson()`, `ensureJsonFile()`
- `training_location_utils.js` – gym/uni constants and mappings
- `main_manager_config.js` – JSON config file (not a real JS script)

### Legacy / Experimental
- `1st-hackworm.js`, `hack-worker.js` – legacy hacking
- `befehltest.js`, `scp_kopieren.js`, `test.js` – experimental/duplicate
- `umbenennen_server.js` – one-time legacy rename script
- `manager_infiltrate.js` – file deleted, no longer exists
