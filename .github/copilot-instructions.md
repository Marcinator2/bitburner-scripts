# Bitburner Project – Copilot Instructions

This is a Bitburner automation project. All scripts run inside the Bitburner game engine (NS2/JS).
Scripts use the `ns` (NetscriptJS) API. All files are deployed into the game via the Bitburner VS Code extension.

---

## Architecture

- `main_manager.js` ist der zentrale Supervisor und liest `main_manager_config.js` (JSON-Datei trotz .js-Endung; enthaelt loopMs, tail und den services-Block)
- Services in `main_manager.js`: hack, hacknet, stocks, gang, negativeKarma, programs, combatTrainer, playerStatsWorker, playerStatsView, overview
- `auto-hack-manager.js` ist der zentrale Hacking-Manager; startet v_hack.js, v_grow.js, v_weaken.js und share-ram.js
- `auto-hack-manager.js` begrenzt Batch-Starts pro Scheduler-Runde und gibt regelmaessig per sleep(0) an die Engine zurueck (verhindert Endlosschleifen-Erkennung und Save-Explosionen)
- `auto-hack-manager.js` skaliert laufende share-ram.js-Instanzen auf die Ziel-Quote hoch
- Server-Provisioning: `new_server_buy.js` → `new_server_setup.js` → kopiert Skripte, startet `profit-check.js` + `manager_share-ram.js`
- Player-Stats-Pipeline: `player_stats_worker.js` schreibt `player_stats_data.txt`; `player_stats.js` liest und visualisiert sie; Dateiformat: `{ version, sampleMs, maxSamples, samples[] }`
- combatTrainer ist config-gesteuert: GUI-Checkboxen fuer STR/DEF/DEX/AGI/Charisma schreiben nach `services.combatTrainer.stats`; `combat_stat_trainer.js` liest diese Auswahl live
- `combat_stat_trainer.js`: STR/DEF/DEX/AGI laufen ueber Gym, Charisma ueber universityCourse; normalisiert Charisma-Kurs via normalizeUniversityCourse
- `manager_gui.js` hat Server-Admin-Bereich mit RAM-Auswahl fuer Kauf/Upgrade, Live-Kostenanzeige; `new_server_buy.js` und `upgrade_Server.js` akzeptieren RAM-Args; `upgrade_Server.js` hat skipPrompt=true
- `manager_karma.js`: eigener Service fuer negatives Karma; waehlt bestes Crime nach Karma/s, fordert mind. 90% Chance, trainiert bei Bedarf via `combat_stat_trainer.js`; `manager_gang.js` greift nur auf Gang-APIs zu wenn Gang bereits existiert
- `manager_crime.js` und `manager_karma.js` sind unabhaengig: crime = $/s, karma = Karma/s mit Mindest-Chance-Pruefung
- `runtime_file_utils.js`: reine Library, kein Standalone-Script; exportiert `cloneJson()` und `ensureJsonFile()`
- `training_location_utils.js`: reine Konstanten-Library fuer Gym/Uni-Standorte, Kursnamen, Kosten, Stat-Mappings
- `bitburner-src-stable/` spiegelt den stabilen Bitburner-Quellstand; kann lokal fuer API-, Konstanten- und Implementierungsrecherche genutzt werden
- `README.md` enthaelt die aktuelle Projektuebersicht, Ablaufketten und Aenderungsvorgaben

---

## Script Inventory

### Hacking
- `auto-hack-manager.js` – zentraler Hacking-Manager
- `v_hack.js`, `v_grow.js`, `v_weaken.js` – Worker-Scripts
- `money-hack.js` – einfaches Hack-Script
- `1st-hackworm.js`, `hack-worker.js` – legacy
- `launch-hackworm.js` – kauft Server "hackworm-host" (16 GB), deployt 1st-hackworm.js + v_*.js

### Manager-Services
- `main_manager.js` – zentraler Supervisor
- `manager_gui.js` – GUI fuer alle Services
- `manager_hacknet.js` – Hacknet-Automatisierung
- `manager_stocks.js` + `stock_manager_worker.js` – Stock-Trading
- `manager_gang.js` – Gang-Management (nur wenn Gang existiert)
- `manager_karma.js` – negatives Karma via Crime (Karma/s)
- `manager_crime.js` – Geld via Crime ($/s), kein Karma-Fokus
- `manager_augments.js` – kauft Augments kategorie-gefiltert (hacking/combat/hacknet/bladeburner/charisma); braucht SF4
- `manager_backdoor.js` – installiert Backdoors per BFS alle 30s; braucht SF4
- `manager_corporation.js` – vollautomatischer Corp-Manager (Divisions, Produkte, Invest-Runden, IPO); exportiert `getCorpStatus(ns)`
- `manager_ipvgo.js` – IPvGO-Matches in Endlosschleife mit opponent-spezifischen KI-Strategien; Args: [opponent?, boardSize?]
- `manager_stats.js` – trainiert Combat-Stats automatisch
- `manager_share-ram.js` – startet share-ram.js

### Player Stats
- `player_stats_worker.js` – schreibt JSON-Historie nach `player_stats_data.txt`
- `player_stats.js` – liest und visualisiert Trends im Tail-Fenster
- `combat_stat_trainer.js` – trainiert STR/DEF/DEX/AGI (Gym) und Charisma (Uni) auf Zielwerte

### Infrastruktur
- `new_server_buy.js` – kauft Server und startet new_server_setup.js
- `new_server_setup.js` – kopiert Skripte, startet profit-check.js + manager_share-ram.js
- `upgrade_Server.js` – upgradet RAM eines Servers; Args: [server, ram, skipPrompt?]
- `share-ram.js` – teilt RAM mit Factions
- `buy-neuroflux.js` – kauft NeuroFlux Governor endlos; Args: [faction?, reserveMoney?]; braucht SF4
- `auto-leveler.js` – automatisches Leveln
- `overview.js` – beobachtet money-hack.js
- `profit-check.js` – Hilfsskript
- `find-server.js` – Hilfsskript

### Libraries (kein Standalone-Start)
- `runtime_file_utils.js` – `cloneJson()`, `ensureJsonFile()`
- `training_location_utils.js` – Gym/Uni-Konstanten und Mappings
- `main_manager_config.js` – JSON-Konfigdatei (kein echtes JS-Script)

### Legacy / Experimentell
- `1st-hackworm.js`, `hack-worker.js` – legacy Hacking
- `befehltest.js`, `scp_kopieren.js`, `test.js` – experimentell/duplikat
- `umbenennen_server.js` – einmaliges Legacy-Umbenennen-Script
- `manager_infiltrate.js` – Datei geloescht, existiert nicht mehr
