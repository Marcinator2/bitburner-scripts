// auto-hack-manager.js
// Bitburner Script: Optimierter HWGW-Batch-Manager
// Alle erreichbaren Server werden gehackt. Nutzt home + MeinServer_ als Runner.
// Worker-Scripte (v_hack.js, v_grow.js, v_weaken.js) müssen delay als 2. Argument unterstützen.

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");

    // ── Konfiguration ────────────────────────────────────────────────────────
    const H_SCRIPT      = "v_hack.js";
    const G_SCRIPT      = "v_grow.js";
    const W_SCRIPT      = "v_weaken.js";
    const SHARE_SCRIPT  = "share-ram.js";
    const SHARE_QUOTA   = 0.1;   // 10% RAM pro MeinServer_ für share-ram.js reservieren
    const HACK_FRACTION = 0.5;   // Anteil des Max-Geldes der pro Batch gestohlen wird
    const SPACING       = 200;   // ms Abstand zwischen den Finish-Zeitpunkten im Batch
    const HOME_RESERVE  = 32;    // GB die auf home reserviert bleiben
    const LOOP_DELAY    = 2000;  // Intervall der Manager-Schleife in ms
    // ─────────────────────────────────────────────────────────────────────────

    // ── Hilfsfunktionen ──────────────────────────────────────────────────────

    /** Alle erreichbaren Server per BFS */
    function scanAll() {
        const found = new Set(["home"]);
        const stack = ["home"];
        while (stack.length) {
            for (const s of ns.scan(stack.pop())) {
                if (!found.has(s)) { found.add(s); stack.push(s); }
            }
        }
        return [...found];
    }

    /** Versucht Root-Zugang auf einem Server zu erlangen */
    function tryNuke(s) {
        if (ns.hasRootAccess(s)) return true;
        if (ns.getServerRequiredHackingLevel(s) > ns.getHackingLevel()) return false;

        // Ports öffnen mit verfügbaren Tools
        let openPorts = 0;
        if (ns.fileExists("BruteSSH.exe",  "home")) { ns.brutessh(s);   openPorts++; }
        if (ns.fileExists("FTPCrack.exe",  "home")) { ns.ftpcrack(s);   openPorts++; }
        if (ns.fileExists("relaySMTP.exe", "home")) { ns.relaysmtp(s);  openPorts++; }
        if (ns.fileExists("HTTPWorm.exe",  "home")) { ns.httpworm(s);   openPorts++; }
        if (ns.fileExists("SQLInject.exe", "home")) { ns.sqlinject(s);  openPorts++; }

        if (openPorts >= ns.getServerNumPortsRequired(s)) {
            ns.nuke(s);
            ns.tprint(`[Nuke] Root-Zugang erlangt: ${s}`);
            return true;
        }
        return false;
    }

    /** Ist der Server ein hackbares Ziel? */
    function isTarget(s) {
        if (s === "home" || s.startsWith("MeinServer_")) return false;
        return ns.hasRootAccess(s)
            && ns.getServerRequiredHackingLevel(s) <= ns.getHackingLevel()
            && ns.getServerMaxMoney(s) > 0;
    }

    /** Ist der Server ein Runner (führt Scripte aus)? */
    function isRunner(s) {
        if (s === "home") return ns.getServerMaxRam(s) > HOME_RESERVE;
        // Alle Server mit Root-Zugang und RAM nutzen
        return ns.hasRootAccess(s) && ns.getServerMaxRam(s) > 0;
    }

    /** Freier RAM aller Runner als Array [{host, free}] – MeinServer_ zuerst, dann externe */
    function runnerRamList(runners) {
        return runners.map(r => {
            let reserve = r === "home" ? HOME_RESERVE : 0;
            // Für MeinServer_: 10% RAM immer für share-ram.js freihalten
            if (r.startsWith("MeinServer_")) {
                reserve += ns.getServerMaxRam(r) * SHARE_QUOTA;
            }
            return {
                host: r,
                free: Math.max(0, ns.getServerMaxRam(r) - ns.getServerUsedRam(r) - reserve)
            };
        })
        .filter(r => r.free > 0)
        .sort((a, b) => {
            // Reihenfolge: MeinServer_ > externe Server > home
            const rank = h => h.startsWith("MeinServer_") ? 0 : h === "home" ? 2 : 1;
            return rank(a.host) - rank(b.host);
        });
    }

    /**
     * Verteile `threads` Instanzen von `script` über alle Runner.
     * args werden an die Worker weitergegeben.
     * Gibt true zurück wenn alle Threads gestartet werden konnten.
     */
    function distribute(ramList, script, threads, ...args) {
        const ramPer = ns.getScriptRam(script, "home");
        let remaining = threads;
        for (const r of ramList) {
            if (remaining <= 0) break;
            const canRun = Math.min(remaining, Math.floor(r.free / ramPer));
            if (canRun > 0 && ns.exec(script, r.host, canRun, ...args) > 0) {
                r.free -= canRun * ramPer;
                remaining -= canRun;
            }
        }
        return remaining === 0;
    }

    /** Scripte auf alle Runner kopieren */
    async function scpToRunners(runners) {
        const scripts = [H_SCRIPT, G_SCRIPT, W_SCRIPT];
        for (const r of runners) {
            if (r !== "home") await ns.scp(scripts, r);
        }
    }

    // ── HWGW-Berechnungen ────────────────────────────────────────────────────

    /**
     * Berechne Thread-Anzahlen für einen HWGW-Batch.
     * Annahme: Ziel ist auf minSec + maxMoney (vorbereitet).
     */
    function calcBatch(target) {
        const hackPer     = ns.hackAnalyze(target);
        const hackThreads = Math.max(1, Math.floor(HACK_FRACTION / hackPer));
        const stoleFrac   = Math.min(hackPer * hackThreads, 0.99);

        const growThreads = Math.max(1, Math.ceil(
            ns.growthAnalyze(target, 1 / (1 - stoleFrac))
        ));

        const wPer        = ns.weakenAnalyze(1);
        const w1Threads   = Math.max(1, Math.ceil(ns.hackAnalyzeSecurity(hackThreads)   / wPer));
        const w2Threads   = Math.max(1, Math.ceil(ns.growthAnalyzeSecurity(growThreads) / wPer));

        return { hackThreads, growThreads, w1Threads, w2Threads };
    }

    /** Gesamter RAM-Bedarf eines Batches in GB */
    function batchRam(b) {
        return b.hackThreads * ns.getScriptRam(H_SCRIPT, "home")
             + b.growThreads * ns.getScriptRam(G_SCRIPT, "home")
             + (b.w1Threads + b.w2Threads) * ns.getScriptRam(W_SCRIPT, "home");
    }

    // ── Zustandsprüfung ──────────────────────────────────────────────────────

    function isReady(target) {
        return ns.getServerSecurityLevel(target) <= ns.getServerMinSecurityLevel(target) + 0.5
            && ns.getServerMoneyAvailable(target) >= ns.getServerMaxMoney(target) * 0.95;
    }

    // ── Vorbereitung ─────────────────────────────────────────────────────────

    /**
     * Startet Weaken/Grow-Scripte um einen Server auf minSec + maxMoney zu bringen.
     * Läuft nicht-blockierend – Scripte laufen im Hintergrund.
     */
    function prepareTarget(target, ramList) {
        const minSec   = ns.getServerMinSecurityLevel(target);
        const maxMoney = ns.getServerMaxMoney(target);
        const curSec   = ns.getServerSecurityLevel(target);
        const curMoney = ns.getServerMoneyAvailable(target) || 1;
        let launched   = false;

        if (curSec > minSec + 0.5) {
            const threads = Math.ceil((curSec - minSec) / ns.weakenAnalyze(1));
            if (distribute(ramList, W_SCRIPT, threads, target, 0)) launched = true;
        }
        if (curMoney < maxMoney * 0.95) {
            const threads = Math.ceil(ns.growthAnalyze(target, maxMoney / curMoney));
            if (distribute(ramList, G_SCRIPT, threads, target, 0)) launched = true;
        }
        return launched;
    }

    // ── HWGW-Batch starten ───────────────────────────────────────────────────

    /**
     * Startet einen vollständigen HWGW-Batch für `target`.
     *
     * Timing-Konzept (Finish-Reihenfolge: H → W1 → G → W2):
     *   W1 startet sofort   (Referenz, finish = weakenTime)
     *   H  startet mit delay = weakenTime - hackTime   - SPACING
     *   G  startet mit delay = weakenTime - growTime   + SPACING
     *   W2 startet mit delay = 2 * SPACING
     *
     * uid verhindert, dass ns.exec() doppelte Scripte ablehnt.
     */
    function launchBatch(target, ramList, uid) {
        const hackTime   = ns.getHackTime(target);
        const weakenTime = ns.getWeakenTime(target);
        const growTime   = ns.getGrowTime(target);

        const delay_W1 = 0;
        const delay_H  = Math.max(0, weakenTime - hackTime  - SPACING);
        const delay_G  = Math.max(0, weakenTime - growTime  + SPACING);
        const delay_W2 = 2 * SPACING;

        const batch = calcBatch(target);
        const totalNeeded = batchRam(batch);
        const totalFree   = ramList.reduce((s, r) => s + r.free, 0);
        if (totalFree < totalNeeded) return false;

        // Starte alle 4 Operationen – uid als letztes Arg damit PIDs eindeutig sind
        return distribute(ramList, W_SCRIPT, batch.w1Threads,  target, delay_W1, uid + "w1")
            && distribute(ramList, H_SCRIPT, batch.hackThreads, target, delay_H,  uid + "h")
            && distribute(ramList, G_SCRIPT, batch.growThreads, target, delay_G,  uid + "g")
            && distribute(ramList, W_SCRIPT, batch.w2Threads,  target, delay_W2, uid + "w2");
    }

    // ── Profitabilität ───────────────────────────────────────────────────────

    /** Sortiere Ziele nach erwarteter Gewinnrate (höchstes zuerst) */
    function sortByProfit(targets) {
        return [...targets].sort((a, b) => {
            const rate = t => ns.getServerMaxMoney(t)
                             * ns.hackAnalyze(t)
                             * HACK_FRACTION
                             / ns.getWeakenTime(t);
            return rate(b) - rate(a);
        });
    }

    // ── Hauptschleife ────────────────────────────────────────────────────────

    // ── Einmalige Initialisierung ────────────────────────────────────────────

    /** Fremde Scripte auf Runnern beenden, Worker-Scripte bleiben erhalten */
    async function initRunners(runners) {
        const workerScripts = new Set([H_SCRIPT, G_SCRIPT, W_SCRIPT, SHARE_SCRIPT]);
        let killed = false;
        for (const r of runners) {
            if (r === "home") continue;
            for (const proc of ns.ps(r)) {
                if (!workerScripts.has(proc.filename)) {
                    ns.kill(proc.pid);
                    ns.print(`[Init] Beendet: ${proc.filename} auf ${r}`);
                    killed = true;
                }
            }
        }
        if (killed) await ns.sleep(200);
        // Worker-Scripte auf alle Runner kopieren
        const scripts = [H_SCRIPT, G_SCRIPT, W_SCRIPT, SHARE_SCRIPT];
        for (const r of runners) {
            if (r !== "home") await ns.scp(scripts, r);
        }
        // share-ram.js nur auf MeinServer_ starten (max 10% RAM)
        const shareRam = ns.getScriptRam(SHARE_SCRIPT, "home");
        for (const r of runners) {
            if (!r.startsWith("MeinServer_")) continue;
            if (ns.scriptRunning(SHARE_SCRIPT, r)) continue;
            const maxRam     = ns.getServerMaxRam(r);
            const shareQuota = maxRam * SHARE_QUOTA;
            const threads = Math.floor(shareQuota / shareRam);
            if (threads < 1) {
                ns.print(`[Init] share-ram.js auf ${r} übersprungen (zu wenig RAM: ${shareQuota.toFixed(1)} GB < ${shareRam} GB)`);
                continue;
            }
            ns.exec(SHARE_SCRIPT, r, threads);
            ns.print(`[Init] share-ram.js auf ${r} mit ${threads} Thread(s) gestartet.`);
        }
    }

    ns.tprint("Auto-Hack Manager gestartet.");

    // Einmalig beim Start: MeinServer_ leeren
    {
        const initServers = scanAll().filter(isRunner);
        await initRunners(initServers);
    }

    let uid = 0;

    while (true) {
        const allServers = scanAll();

        // Versuche Root-Zugang auf allen noch nicht gehackten Servern
        for (const s of allServers) {
            if (!ns.hasRootAccess(s)) tryNuke(s);
        }

        const runners    = allServers.filter(isRunner);
        const targets    = sortByProfit(allServers.filter(isTarget));

        // Worker-Scripte auf neue Runner kopieren (bereits laufende bleiben)
        await scpToRunners(runners);

        const ramList  = runnerRamList(runners);
        let batched    = 0;
        let prepping   = 0;
        let noRam      = 0;

        for (const target of targets) {
            if (isReady(target)) {
                // Server ist optimal vorbereitet → HWGW-Batch starten
                if (launchBatch(target, ramList, String(uid++))) {
                    batched++;
                } else {
                    noRam++;
                }
            } else {
                // Server muss zuerst vorbereitet werden
                if (prepareTarget(target, ramList)) prepping++;
            }
        }

        // Status-Anzeige im Log
        const totalFree = ramList.reduce((s, r) => s + r.free, 0).toFixed(1);
        const ready     = targets.filter(isReady).length;
        ns.clearLog();
        ns.print("╔══════════════════════════════╗");
        ns.print(`║  Auto-Hack Manager           ║`);
        ns.print("╠══════════════════════════════╣");
        ns.print(`║  Ziele:        ${String(targets.length).padStart(4)}           ║`);
        ns.print(`║  Bereit:       ${String(ready).padStart(4)}           ║`);
        ns.print(`║  In Vorber.:   ${String(prepping).padStart(4)}           ║`);
        ns.print(`║  Batches gest: ${String(batched).padStart(4)}           ║`);
        ns.print(`║  Kein RAM:     ${String(noRam).padStart(4)}           ║`);
        ns.print(`║  Runner:       ${String(runners.length).padStart(4)}           ║`);
        ns.print(`║  Freier RAM:   ${String(totalFree).padStart(7)} GB       ║`);
        ns.print("╠══════════════════════════════╣");
        // RAM pro Runner anzeigen
        for (const r of ramList) {
            const label = r.host.length > 14 ? r.host.slice(0, 14) : r.host.padEnd(14);
            ns.print(`║  ${label}  ${String(r.free.toFixed(0)).padStart(5)} GB       ║`);
        }
        ns.print("╚══════════════════════════════╝");

        await ns.sleep(LOOP_DELAY);
    }
}
