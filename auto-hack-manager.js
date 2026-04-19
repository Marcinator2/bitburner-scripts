// auto-hack-manager.js
// Bitburner Script: Optimierter HWGW-Batch-Manager2l
// Alle erreichbaren Server werden gehackt. Nutzt home + MeinServer_ als Runner.12
// Worker-Scripte (v_hack.js, v_grow.js, v_weaken.js) müssen delay als 2. Argument unterstützen.

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");

    // ── Konfiguration ────────────────────────────────────────────────────────
    const H_SCRIPT      = "v_hack.js";
    const G_SCRIPT      = "v_grow.js";
    const W_SCRIPT      = "v_weaken.js";
    const SHARE_SCRIPT  = "share-ram.js";
    const SHARE_QUOTA   = 0.01;   // Zielanteil pro Runner fuer share-ram.js; laufende Instanzen werden auf diese Groesse nachgezogen
    const HACK_FRACTION = 0.99;  // Maximaler Anteil des Max-Geldes pro Batch (so viel wie RAM erlaubt)
    const SPACING       = 200;   // ms Abstand zwischen den Finish-Zeitpunkten im Batch
    const HOME_RESERVE  = 45;    // GB die auf home reserviert bleiben
    const LOOP_DELAY    = 1000;  // Intervall der Manager-Schleife in ms
    const MIN_MONEY_FRAC = 0.85; // Ziel gilt als bereit wenn es mindestens 85% seines Max-Geldes hat
    const MAX_BATCHES_PER_CYCLE = 300//250; // Harte Obergrenze pro Manager-Runde gegen Prozess-Explosionen
    const BATCH_YIELD_EVERY = 25; // Regelmaessig an die Engine zurueckgeben, damit keine Endlosschleife erkannt wird
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

    /** Versucht Root-Zugang auf einem Server zu erlangen .ls
     * 
    */
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
            return {
                host: r,
                free: Math.max(0, ns.getServerMaxRam(r) - ns.getServerUsedRam(r) - reserve)
            };
        })
        .filter(r => r.free > 0)
        .sort((a, b) => b.free - a.free); // meisten freien RAM zuerst → home (4PB) wird bevorzugt
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
        const scripts = [H_SCRIPT, G_SCRIPT, W_SCRIPT, SHARE_SCRIPT];
        for (const r of runners) {
            if (r !== "home") await ns.scp(scripts, r);
        }
    }

    function getRunningShareThreads(host) {
        return ns.ps(host)
            .filter(proc => proc.filename === SHARE_SCRIPT)
            .reduce((sum, proc) => sum + proc.threads, 0);
    }

    function shareThreadsForRunner(host) {
        if (host === "home") return 0;

        const shareRam = ns.getScriptRam(SHARE_SCRIPT, "home");
        if (shareRam <= 0) return 0;

        const maxRam = ns.getServerMaxRam(host);
        if (maxRam < shareRam) return 0;

        return Math.max(1, Math.floor((maxRam * SHARE_QUOTA) / shareRam));
    }

    function canSpareRamForShare(host, shareThreads, currentShareThreads = 0) {
        if (shareThreads < 1) return false;

        const shareRam = ns.getScriptRam(SHARE_SCRIPT, "home");
        const minWorkerRam = Math.min(
            ns.getScriptRam(H_SCRIPT, "home"),
            ns.getScriptRam(G_SCRIPT, "home"),
            ns.getScriptRam(W_SCRIPT, "home")
        );
        const freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
        const reclaimableShareRam = currentShareThreads * shareRam;
        const remainingAfterShare = freeRam + reclaimableShareRam - (shareThreads * shareRam);

        return remainingAfterShare >= minWorkerRam;
    }

    function ensureShareOnRunners(runners) {
        for (const host of runners) {
            if (host === "home") continue;

            const runningThreads = getRunningShareThreads(host);
            const threads = shareThreadsForRunner(host);
            if (threads < 1) {
                if (runningThreads > 0) {
                    ns.scriptKill(SHARE_SCRIPT, host);
                }
                continue;
            }

            if (runningThreads === threads) continue;

            if (!canSpareRamForShare(host, threads, runningThreads)) {
                ns.print(`[Share] ${host} übersprungen: share-ram.js würde keinen Platz mehr für H/G/W lassen.`);
                continue;
            }

            if (runningThreads > 0) {
                ns.scriptKill(SHARE_SCRIPT, host);
            }

            const pid = ns.exec(SHARE_SCRIPT, host, threads);
            if (pid > 0) {
                const action = runningThreads > 0 ? "skaliert" : "gestartet";
                ns.print(`[Share] ${SHARE_SCRIPT} auf ${host} mit ${threads} Thread(s) ${action}.`);
            }
        }
    }

    function safeGrowthThreads(target, multiplier) {
        const growMult = Number.isFinite(multiplier) ? multiplier : Number(multiplier);
        if (!Number.isFinite(growMult) || growMult < 1) {
            ns.print(`[Warn] safeGrowthThreads: ungültiger growMult=${multiplier} für ${target}, setze 1`);
            return 1;
        }
        return Math.max(1, Math.ceil(ns.growthAnalyze(target, growMult)));
    }

    // ── HWGW-Berechnungen ────────────────────────────────────────────────────

    /**
     * Berechne Thread-Anzahlen für einen HWGW-Batch.
     * Annahme: Ziel ist auf minSec + maxMoney (vorbereitet).
     */
    function calcBatch(target, fraction = HACK_FRACTION) {
        const hackPer = ns.hackAnalyze(target);
        const desiredSteal = Math.min(fraction, 0.99);
        const hackThreads = Number.isFinite(hackPer) && hackPer > 0
            ? Math.max(1, Math.floor(desiredSteal / hackPer))
            : 1;
        const stoleFrac = Number.isFinite(hackPer) && hackPer > 0
            ? Math.min(hackPer * hackThreads, 0.99)
            : 0.01;

        // growthAnalyze liefert die minimale Threadzahl, um mindestens den Faktor zu erreichen.
        // Die Maschine selbst kann das Ergebnis dann auf maxMoney begrenzen.
        const growMult = 1 / (1 - stoleFrac);
        const growThreads = safeGrowthThreads(target, growMult);

        const wPer = ns.weakenAnalyze(1);
        const w1Threads = Math.max(1, Math.ceil(ns.hackAnalyzeSecurity(hackThreads) / wPer));
        const w2Threads = Math.max(1, Math.ceil(ns.growthAnalyzeSecurity(growThreads) / wPer));

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
            && ns.getServerMoneyAvailable(target) >= ns.getServerMaxMoney(target) * MIN_MONEY_FRAC;
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
        const curMoney = Math.max(1, ns.getServerMoneyAvailable(target));
        let launched   = false;

        if (curSec > minSec + 0.5) {
            const threads = Math.ceil((curSec - minSec) / ns.weakenAnalyze(1));
            if (distribute(ramList, W_SCRIPT, threads, target, 0)) launched = true;
        }
        if (curMoney < maxMoney * MIN_MONEY_FRAC) {
            const growMult = maxMoney / curMoney;
            const threads = safeGrowthThreads(target, growMult);
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

        const totalFree = ramList.reduce((s, r) => s + r.free, 0);

        // Binärsuche: maximale Fraction die noch in den RAM passt
        let lo = 0.001, hi = HACK_FRACTION;
        for (let i = 0; i < 20; i++) {
            const mid = (lo + hi) / 2;
            if (batchRam(calcBatch(target, mid)) <= totalFree) lo = mid;
            else hi = mid;
        }
        const fraction = lo;
        const batch = calcBatch(target, fraction);
        const totalNeeded = batchRam(batch);
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

    // ── Programme kaufen / programmieren (benötigt Singularity SF4) ─────────

    /**
     * Kauft fehlende Port-Cracker über den Darkweb-Shop oder programmiert sie.
     * Wird per try/catch geschützt – ohne SF4 läuft das Script einfach weiter.
     */
    function manageProgramAcquisition() {
        try {
            const programs = [
                "BruteSSH.exe",
                "FTPCrack.exe",
                "relaySMTP.exe",
                "HTTPWorm.exe",
                "SQLInject.exe",
            ];

            const missing = programs.filter(p => !ns.fileExists(p, "home"));
            if (missing.length === 0) return;

            // TOR-Router kaufen (nötig für Darkweb-Käufe)
            ns.singularity.purchaseTor();

            // Programme kaufen falls genug Geld vorhanden
            for (const prog of missing) {
                if (ns.singularity.purchaseProgram(prog)) {
                    ns.tprint(`[Prog] Gekauft: ${prog}`);
                }
            }

            // Noch fehlende Programme selbst programmieren
            const stillMissing = programs.filter(p => !ns.fileExists(p, "home"));
            if (stillMissing.length === 0) return;

            const currentWork = ns.singularity.getCurrentWork();
            const alreadyCoding = currentWork !== null && currentWork.type === "CREATE_PROGRAM";
            if (!alreadyCoding) {
                if (ns.singularity.createProgram(stillMissing[0], false)) {
                    ns.print(`[Prog] Programmiere: ${stillMissing[0]}`);
                }
            }
        } catch (_) {
            // Singularity API nicht verfügbar (kein SF4) – wird ignoriert
        }
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
        ensureShareOnRunners(runners);
    }

    ns.tprint("Auto-Hack Manager gestartet.");

    // Einmalig beim Start: MeinServer_ leeren
    {
        const initServers = scanAll().filter(isRunner);
        await initRunners(initServers);
    }

    let uid = 0;

    while (true) {
        manageProgramAcquisition();

        const allServers = scanAll();

        // Versuche Root-Zugang auf allen noch nicht gehackten Servern
        for (const s of allServers) {
            if (!ns.hasRootAccess(s)) tryNuke(s);
        }

        const runners = allServers.filter(isRunner);
        const targets = allServers.filter(isTarget);

        // Worker-Scripte auf neue Runner kopieren (bereits laufende bleiben)
        await scpToRunners(runners);
        ensureShareOnRunners(runners);

        const ramList = runnerRamList(runners);
        let batched = 0;
        let prepping = 0;
        let noRam = 0;

        const sortedTargets = sortByProfit(targets);
        const readyTargets  = sortedTargets.filter(isReady);
        const notReady      = sortedTargets.filter(t => !isReady(t));

        // Vorbereitung für nicht-bereite Server
        for (const target of notReady) {
            const alreadyPreparing = runners.some(r =>
                ns.ps(r).some(p => p.args[0] === target
                    && (p.filename === W_SCRIPT || p.filename === G_SCRIPT))
            );
            if (!alreadyPreparing) {
                if (prepareTarget(target, ramList)) prepping++;
            } else {
                prepping++;
            }
        }

        // Round-Robin: jedes bereite Ziel bekommt reihum einen Batch,
        // bis kein RAM mehr für irgendeinen Batch reicht.
        let anyLaunched = true;
        let cycleCapped = false;
        while (anyLaunched && batched < MAX_BATCHES_PER_CYCLE) {
            anyLaunched = false;
            for (const target of readyTargets) {
                if (batched >= MAX_BATCHES_PER_CYCLE) {
                    cycleCapped = true;
                    break;
                }

                if (launchBatch(target, ramList, String(uid++))) {
                    batched++;
                    anyLaunched = true;
                    if (batched % BATCH_YIELD_EVERY === 0) {
                        await ns.sleep(0);
                    }
                } else {
                    noRam++;
                }
            }
        }

        if (batched >= MAX_BATCHES_PER_CYCLE) {
            cycleCapped = true;
        }

        // Status-Anzeige im Log
        const totalFree = ramList.reduce((s, r) => s + r.free, 0).toFixed(1);
        const ready = targets.filter(isReady).length;
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
        ns.print(`║  Batch-Cap:    ${(cycleCapped ? "JA" : "nein").padStart(4)}           ║`);
        ns.print("╠══════════════════════════════╣");
        // RAM pro Runner anzeigen (Top 10)
        const displayList = ramList.slice(0, 10);
        for (const r of displayList) {
            const label = r.host.length > 14 ? r.host.slice(0, 14) : r.host.padEnd(14);
            ns.print(`║  ${label}  ${String(r.free.toFixed(0)).padStart(5)} GB       ║`);
        }
        if (ramList.length > 10) {
            ns.print(`║  ... +${String(ramList.length - 10).padStart(2)} weitere Runner          ║`);
        }
        ns.print("╚══════════════════════════════╝");

        await ns.sleep(LOOP_DELAY);
    }
}


