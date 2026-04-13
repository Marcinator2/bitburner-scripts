# bitburner

Projektuebersicht fuer die Bitburner-Skripte in diesem Repository. Ziel dieser Datei ist, die aktuellen Verantwortlichkeiten, Abhaengigkeiten und Arbeitsregeln festzuhalten, damit spaetere Aenderungen nachvollziehbar bleiben.

## Zielbild

Das Repository ist kein einzelnes Script, sondern ein kleines Script-System mit drei Ebenen:

1. `main_manager.js` als zentraler Supervisor.
2. Mehrere Manager fuer einzelne Domainen wie Hacking, Stocks, Gang, Hacknet oder Player-Stats.
3. Kleine Worker- und Utility-Skripte, die von Managern gestartet oder fuer Einzelaufgaben direkt ausgefuehrt werden.

Der wichtigste Einstiegspunkt fuer den Alltagsbetrieb ist aktuell `main_manager.js` zusammen mit `main_manager_config.txt`.

## Architektur

### 1. Supervisor-Ebene

`main_manager.js`
- liest `main_manager_config.txt`
- startet und ueberwacht einzelne Dienste per `ns.exec(...)`
- trennt Aktivierung (`enabled`), Laufparameter (`args`) und Startschleife (`loopMs`)

Aktuell bekannte Services:
- `hack` -> `auto-hack-manager.js`
- `hacknet` -> `manager_hacknet.js`
- `stocks` -> `manager_stocks.js`
- `gang` -> `manager_gang.js`
- `programs` -> `auto-leveler.js`
- `combatTrainer` -> `combat_stat_trainer.js`
- `playerStatsWorker` -> `player_stats_worker.js`
- `playerStatsView` -> `player_stats.js`
- `overview` -> `overview.js`

### 2. Manager-Ebene

`auto-hack-manager.js`
- scannt das Netzwerk per BFS
- versucht Root-Zugang auf erreichbaren Servern zu erlangen
- unterscheidet zwischen Targets und Runnern
- verteilt `v_hack.js`, `v_grow.js`, `v_weaken.js` batchweise auf verfuegbare Hosts
- reserviert auf `home` und auf gekauften `MeinServer_*`-Hosts gezielt RAM
- startet auf gekauften Servern zusaetzlich `share-ram.js`

`manager_stocks.js`
- handelt Aktien ueber die Stock-API
- nutzt Forecast/Volatilitaet fuer Kauf- und Verkaufsentscheidungen
- startet bei Bedarf ebenfalls `v_hack.js`, `v_grow.js`, `v_weaken.js` auf `home`
- ist funktional ein eigener Manager und kein Unterprozess des Hack-Managers

`manager_gang.js`
- verwaltet Gang-Mitglieder, Aufgaben, Equipment und Warfare-Verhalten
- enthaelt relativ viel Fachlogik und viele Stellschrauben direkt im Script
- ist eher ein eigenstaendiges Teilsystem als nur ein kleiner Helfer

`manager_hacknet.js`
- bewertet Upgrade-Optionen fuer Hacknet-Nodes ueber eine einfache ROI-Heuristik
- kauft oder upgraded Nodes, sofern die API verfuegbar ist

`manager_stats.js`
- trainiert Combat-Stats automatisch ueber die Singularity-API
- ist aktuell nicht in `main_manager.js` eingebunden, aber logisch ein separater Manager/Trainer

`combat_stat_trainer.js`
- trainiert die im Config-/GUI-Modus ausgewaehlten Stats dauerhaft
- ist jetzt direkt als Service `combatTrainer` in `main_manager.js` integrierbar
- liest seine Auswahl live aus `main_manager_config.txt`, statt auf feste Zielwerte zu laufen
- trainiert STR/DEF/DEX/AGI im Gym und CHARISMA ueber Uni/Kurs

`auto-leveler.js`
- ist fuer automatische Programmbeschaffung gedacht
- wird ueber den Service `programs` angesteuert

### 3. Worker- und Utility-Ebene

`v_hack.js`, `v_grow.js`, `v_weaken.js`
- generische Worker fuer Batch-Hacking
- werden hauptsaechlich vom Hack-Manager und teilweise vom Stock-Manager gestartet

`share-ram.js`
- teilt freie RAM-Kapazitaet ueber `share()`
- wird von mehreren Stellen eingesetzt und ist damit ein wiederverwendbarer Infrastruktur-Worker
- auf `MeinServer_*` soll es nur einmal real laufen; der Hack-Manager reserviert dafuer nicht mehr doppelt zusaetzlichen RAM

`player_stats_worker.js`
- sammelt periodisch Spielerzustand
- schreibt die Historie als JSON in `player_stats_data.txt`

`player_stats.js`
- liest `player_stats_data.txt`
- rendert Trendtabellen und ASCII-Charts im Tail-Fenster

`overview.js`
- erstellt eine einmalige Betriebsuebersicht ueber Einkommen, Prozesse, RAM und Serverstatus

`find-server.js`
- berechnet per BFS den Connect-Pfad zu einem Zielserver

`profit-check.js`
- Monitoring-/Hilfsskript fuer Profit- oder Einkommenspruefung auf Hosts

## Wichtige Ablaufketten

### Hauptbetrieb

`main_manager.js`
-> liest `main_manager_config.txt`
-> startet aktivierte Services
-> ueberwacht fortlaufend, ob diese bereits laufen oder neu gestartet werden muessen

### Player-Stats-Pipeline

`player_stats_worker.js`
-> schreibt `player_stats_data.txt`
-> `player_stats.js` liest dieselbe Datei und zeigt Trends an

Die Stats-Anzeige ist damit absichtlich von der Datensammlung getrennt.

### Server-Kauf und Provisioning

`new_server_buy.js`
-> kauft einen neuen `MeinServer_*`
-> startet `new_server_setup.js`

`new_server_setup.js`
-> kopiert mehrere Skripte auf den neuen Server
-> startet dort `profit-check.js`
-> startet dort `manager_share-ram.js`

`manager_share-ram.js`
-> startet `share-ram.js` auf dem Zielhost

### Direkter Einzel-Hack

`money-hack.js`
- ist ein einfacherer, direkter Hack-/Grow-/Weaken-Loop fuer einen einzelnen Target-Host
- wirkt im Vergleich zu `auto-hack-manager.js` wie ein aelterer oder alternativer Pfad

## Dateigruppen

### Zentrale Dateien

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

### Player- und Combat-Stats

- `player_stats_worker.js`
- `player_stats.js`
- `manager_stats.js`
- `combat_stat_trainer.js`

### Gang und Hacknet

- `manager_gang.js`
- `manager_hacknet.js`

### Server-Management und Admin

- `new_server_buy.js`
- `new_server_setup.js`
- `upgrade_Server.js`
- `umbenennen_server.js`

### Utilities und Experimente

- `overview.js`
- `find-server.js`
- `profit-check.js`
- `befehltest.js`
- `scp_kopieren.js`
- `test.js`
- `Merkliste.txt`

## Konfiguration und Daten

Wichtig fuer die VSCode-Bitburner-Erweiterung:
- Runtime-Dateien wie `main_manager_config.txt` und `player_stats_data.txt` muessen nicht aus dem Workspace nach Bitburner gepusht werden.
- Die Skripte legen diese Dateien bei Bedarf selbst im Spiel an oder reparieren sie, wenn sie ungueltig sind.
- Dadurch sollten diese Dateien eher als Ingame-Runtime-Dateien behandelt werden, nicht als regulaere Sync-Dateien.

### `main_manager_config.txt`

Die Datei ist die zentrale Schaltstelle fuer den Supervisor.

Wichtige Felder:
- `loopMs`: Intervall, in dem `main_manager.js` den Dienstestatus prueft
- `tail`: ob der Manager direkt ein Tail-Fenster oeffnen soll
- `services`: Objekt mit Dienstkonfigurationen pro Service-Key

Beispielhafte Services:
- `hack.enabled`
- `stocks.enabled`
- `gang.enabled`
- `combatTrainer.args = ["main_manager_config.txt", "Sector-12", "Powerhouse Gym", false, "Sector-12", "Rothman University", "Leadership"]`
- `combatTrainer.stats = { strength, defense, dexterity, agility, charisma }`
- `playerStatsWorker.args = ["player_stats_data.txt", 10000, 360]`

### `player_stats_data.txt`

Wird zur Laufzeit erzeugt und enthaelt JSON mit etwa folgendem Schema:
- `version`
- `sampleMs`
- `maxSamples`
- `samples[]`

Die Datei ist kein Handarbeitsartefakt, sondern ein Laufzeit-Datenspeicher.

## Vermuteter Reifegrad

### Aktiv genutzte Kernelemente

- `main_manager.js`
- `auto-hack-manager.js`
- `player_stats_worker.js`
- `player_stats.js`
- `manager_stocks.js`
- `manager_gang.js`

### Optional oder feature-gated

- `manager_hacknet.js` nur sinnvoll, wenn die Hacknet-API verfuegbar ist
- `manager_stats.js` benoetigt Singularity / Source-File 4
- `auto-leveler.js` haengt von verfuegbaren APIs und Spielfortschritt ab

### Wahrscheinlich experimentell, alt oder unklar

- `1st-hackworm.js`
- `hack-worker.js`
- `befehltest.js`
- `scp_kopieren.js`
- `test.js`

Diese Dateien sollten vor groesseren Umbauten geprueft werden, damit keine stillen Abhaengigkeiten uebersehen werden.

## Status-Einteilung fuer Aufraeumen

Ab jetzt sollte das Repo gedanklich in vier Klassen getrennt werden.

### A. Produktiv und aktiv pflegen

Diese Dateien sind Teil des aktuellen Zielsystems und sollten bei Aenderungen bevorzugt werden:

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

### B. Produktiv, aber eher Spezial- oder Einzelwerkzeug

Diese Dateien koennen weiter nuetzlich sein, sind aber nicht das zentrale Architektur-Rueckgrat:

- `money-hack.js`
- `profit-check.js`
- `combat_stat_trainer.js`
- `manager_stats.js`
- `upgrade_Server.js`
- `umbenennen_server.js`

### C. Legacy behalten, aber nicht mehr als Fuehrungspfad verwenden

Diese Dateien werden nicht geloescht, sollen aber nicht mehr der Standard fuer neue Erweiterungen sein:

- `1st-hackworm.js`
- `hack-worker.js`

Regel:
- Wenn Hacking erweitert wird, dann im Pfad `auto-hack-manager.js` plus `v_*`-Worker.
- Legacy-Dateien nur anfassen, wenn bewusst ein alter Ablauf repariert oder verglichen werden soll.

### D. Experimentell, Scratch oder Duplikat

Diese Dateien gelten vorerst als nicht-produktiv:

- `befehltest.js`
- `scp_kopieren.js`
- `test.js`

Regel:
- Keine neue Logik auf diese Dateien aufbauen.
- Wenn darin etwas Wertvolles steckt, die Logik in eine produktive Datei uebernehmen und den Rest spaeter archivieren oder entfernen.

## Konkrete Aufraeumregeln

Damit produktiv und experimentell nicht erneut vermischt werden, gelten folgende Arbeitsregeln:

1. Neue Features nur noch in produktive Klassen A oder B einbauen.
2. Legacy-Dateien aus Klasse C nicht als Vorlage fuer neue Manager verwenden.
3. Dateien aus Klasse D nur noch als Referenz lesen, nicht erweitern.
4. Wenn Klasse-D-Code benoetigt wird, zuerst in eine produktive Datei uebertragen und dort sauber einbauen.
5. Doppelte Logik vermeiden: fuer Server-Pfade nur `find-server.js`, fuer Batch-Hacking nur `auto-hack-manager.js` plus `v_*`.

## Nächster sinnvoller Bereinigungsschritt

Wenn wir im naechsten Schritt weiter aufraeumen wollen, ist die sinnvollste Reihenfolge:

1. `test.js` gegen `find-server.js` endgueltig abgleichen und danach archivieren oder loeschen.
2. `1st-hackworm.js` und `hack-worker.js` mit dem heutigen Hacking-Pfad vergleichen und entscheiden, ob sie noch einen echten Zweck haben.
3. `befehltest.js` und `scp_kopieren.js` in einen klaren Archiv-/Scratch-Bereich ueberfuehren oder entfernen.

## Vorgaben fuer spaetere Aenderungen

### 1. Einstiegspunkte klar halten

Neue Automationen nach Moeglichkeit nicht direkt in mehrere Skripte verteilen, sondern ueber einen klaren Einstiegspunkt fuehren:
- global ueber `main_manager.js`
- fachlich ueber einen dedizierten Manager
- technisch ueber kleine Worker

### 2. Konfiguration von Logik trennen

Was haeufig angepasst wird, gehoert bevorzugt in Konfigurationswerte statt fest codiert in lange Schleifen.
Das gilt besonders fuer:
- Aktivierungsflags
- Timingwerte
- Geld- und RAM-Reserven
- Schwellen fuer Kauf, Verkauf oder Training

### 3. Gemeinsame Worker nicht duplizieren

Die `v_*`-Worker und `share-ram.js` sind gemeinsame Infrastruktur. Wenn ihr Verhalten geaendert wird, immer mitdenken:
- Hack-Manager
- Stock-Manager
- Provisioning neuer Server

### 4. Datenfluesse explizit halten

Wenn ein Skript Dateien schreibt, sollte mindestens dokumentiert sein:
- welche Datei beschrieben wird
- welches Format erwartet wird
- wer diese Datei spaeter liest

Aktuell ist die Player-Stats-Pipeline dafuer das sauberste Beispiel.

### 5. Alte und neue Wege nicht unbemerkt mischen

Es gibt im Repo sowohl den neueren Manager-/Worker-Stil als auch aeltere Einzel-Skripte. Vor Erweiterungen sollte geklaert werden, welcher Pfad der bevorzugte ist.

Praktisch bedeutet das:
- neue Hacking-Logik eher in `auto-hack-manager.js` plus `v_*`-Worker integrieren
- `money-hack.js` und aeltere Hacking-Skripte nur gezielt behalten oder bewusst ausmustern

### 6. Script-Rollen im Dateinamen ernst nehmen

Empfohlene Bedeutung:
- `main_*` = globaler Einstiegspunkt
- `manager_*` = dauerlaufender Fachmanager
- `*_worker` oder `v_*` = kleine, gezielt gestartete Ausfuehrungseinheit
- Utility-Skripte nur fuer klar abgegrenzte Einzelaufgaben

## Empfohlene Startpunkte

Fuer den normalen Betrieb:
- `run main_manager.js`
- `run manager_gui.js` fuer ein GUI-Panel mit Buttons zum Aktivieren/Deaktivieren der Services

Fuer Status ohne Dauerloop:
- `run main_manager.js status`
- `run main_manager.js once`

Fuer Einzelwerkzeuge:
- `run find-server.js n00dles`
- `run player_stats.js player_stats_data.txt once`

## GUI fuer den Manager

Es gibt jetzt einen ersten GUI-Pfad ueber `manager_gui.js`.

Funktionen:
- Start/Stop fuer `main_manager.js`
- Button pro Service zum Aktivieren oder Deaktivieren
- Anzeige von Config-Status, Runtime-Status und Script-Verfuegbarkeit
- Fenster ist per Header ziehbar
- Fenster kann ueber `Hide` ausgeblendet und ueber einen schwebenden Button wieder eingeblendet werden
- Server-Admin-Bereich mit Buttons fuer `new_server_buy.js` und `upgrade_Server.js`
- getrennte RAM-Auswahl fuer Kauf und Upgrade direkt im GUI
- Live-Kostenanzeige fuer Kauf und Upgrade direkt im GUI
- Upgrade-Bestaetigung direkt im GUI statt ueber `ns.prompt`, wenn ueber das Panel gestartet
- RAM-Auswahl geht bis `2^20` = `1048576 GB`
- zuletzt gewaehlte GUI-Einstellungen fuer Kauf/Upgrade und Fensterposition werden gespeichert
- offener Upgrade-Bestaetigungszustand wird bei relevanten GUI-Aenderungen sauber zurueckgesetzt
- Stat-Trainer zeigt aktive Stats sowie Combat-/Charisma-Trainingsorte direkt im GUI an

Hinweis zum Combat-Trainer:
Hinweis zum Stat-Trainer:
- Im GUI gibt es Checkboxen fuer STR, DEF, DEX, AGI und CHA.
- Der Trainer laeuft mit den aktuell aktivierten Stats weiter, bis du die Auswahl aenderst.
- Combat-Stats nutzen `combatCity` plus Gym, Charisma nutzt `charismaCity` plus University/Kurs aus `services.combatTrainer.args`.

Wichtig:
- Die GUI schreibt direkt in `main_manager_config.txt`.
- Beim Deaktivieren wird der jeweilige Scriptprozess sofort gestoppt.
- Beim Aktivieren wird der Main-Manager gestartet, falls er noch nicht laeuft.

Einschraenkung:
- Die GUI nutzt den DOM-Zugriff der Bitburner-Oberflaeche. Wenn diese Umgebung einmal nicht verfuegbar ist, waere als Fallback ein Prompt-Menue der robustere Weg.

## Offene Punkte fuer spaeter

- Soll `manager_stats.js` in den zentralen `main_manager.js` aufgenommen werden?
- Welche alten Hacking-Skripte sind noch produktiv relevant und welche koennen archiviert werden?
- Sollten die vielen fest eingebauten Konstanten in `manager_gang.js`, `manager_stocks.js` und `auto-hack-manager.js` schrittweise in Konfigurationsdateien wandern?
- Soll es eine zweite Doku geben, die nur Laufbefehle und Setup-Reihenfolgen sammelt?

## Kurzfazit

Das Projekt ist bereits als kleines Automationssystem aufgebaut. Der zentrale Zusammenhang ist:

`main_manager.js` orchestriert Manager,
Manager orchestrieren Worker,
und nur wenige Skripte schreiben dauerhafte Laufzeitdaten.

Wenn wir spaeter erweitern oder aufraeumen, sollten wir diesen Aufbau erhalten statt neue Sonderwege daneben zu setzen.

