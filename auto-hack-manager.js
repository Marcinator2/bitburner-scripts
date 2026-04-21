// auto-hack-manager.js
// Bitburner Script: Optimized HWGW batch manager
// All reachable servers are hacked. Uses home + MyServer_ as runners.
// Worker scripts (v_hack.js, v_grow.js, v_weaken.js) must support delay as the 2nd argument.

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");

    // ── Configuration ────────────────────────────────────────────────────────
    const H_SCRIPT      = "v_hack.js";
    const G_SCRIPT      = "v_grow.js";
    const W_SCRIPT      = "v_weaken.js";
    const SHARE_SCRIPT  = "share-ram.js";
    const SHARE_QUOTA   = 0.01;   // Target share fraction per runner for share-ram.js; running instances are adjusted to this size
    const HACK_FRACTION = 0.99;  // Maximum fraction of max money per batch (as much as RAM allows)
    const SPACING       = 200;   // ms spacing between finish timestamps in a batch
    const HOME_RESERVE  = 45;    // GB reserved on home
    const LOOP_DELAY    = 1000;  // Manager loop interval in ms
    const MIN_MONEY_FRAC = 0.85; // Target is considered ready when it has at least 85% of its max money
    const MAX_BATCHES_PER_CYCLE = 300//250; // Hard cap per manager round against process explosions
    const BATCH_YIELD_EVERY = 25; // Yield to the engine regularly so no infinite loop is detected
    // ─────────────────────────────────────────────────────────────────────────

    // ── Helper functions ──────────────────────────────────────────────────────

    /** All reachable servers via BFS */
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

    /** Attempts to gain root access on a server */
    function tryNuke(s) {
        if (ns.hasRootAccess(s)) return true;
        if (ns.getServerRequiredHackingLevel(s) > ns.getHackingLevel()) return false;

        // Open ports using available tools
        let openPorts = 0;
        if (ns.fileExists("BruteSSH.exe",  "home")) { ns.brutessh(s);   openPorts++; }
        if (ns.fileExists("FTPCrack.exe",  "home")) { ns.ftpcrack(s);   openPorts++; }
        if (ns.fileExists("relaySMTP.exe", "home")) { ns.relaysmtp(s);  openPorts++; }
        if (ns.fileExists("HTTPWorm.exe",  "home")) { ns.httpworm(s);   openPorts++; }
        if (ns.fileExists("SQLInject.exe", "home")) { ns.sqlinject(s);  openPorts++; }

        if (openPorts >= ns.getServerNumPortsRequired(s)) {
            ns.nuke(s);
            ns.tprint(`[Nuke] Root access gained: ${s}`);
            return true;
        }
        return false;
    }

    /** Is the server a hackable target? */
    function isTarget(s) {
        if (s === "home" || s.startsWith("MyServer_")) return false;
        return ns.hasRootAccess(s)
            && ns.getServerRequiredHackingLevel(s) <= ns.getHackingLevel()
            && ns.getServerMaxMoney(s) > 0;
    }

    /** Is the server a runner (executes scripts)? */
    function isRunner(s) {
        if (s === "home") return ns.getServerMaxRam(s) > HOME_RESERVE;
        // Use all servers with root access and RAM
        return ns.hasRootAccess(s) && ns.getServerMaxRam(s) > 0;
    }

    /** Free RAM of all runners as array [{host, free}] – MyServer_ first, then external */
    function runnerRamList(runners) {
        return runners.map(r => {
            let reserve = r === "home" ? HOME_RESERVE : 0;
            return {
                host: r,
                free: Math.max(0, ns.getServerMaxRam(r) - ns.getServerUsedRam(r) - reserve)
            };
        })
        .filter(r => r.free > 0)
        .sort((a, b) => b.free - a.free); // most free RAM first → home (4PB) is preferred
    }

    /**
     * Distribute `threads` instances of `script` across all runners.
     * args are passed to the workers.
     * Returns true if all threads could be started.
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

    /** Copy scripts to all runners */
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
        ns.print(`[Share] ${host} skipped: share-ram.js would leave no room for H/G/W.`);
                continue;
            }

            if (runningThreads > 0) {
                ns.scriptKill(SHARE_SCRIPT, host);
            }

            const pid = ns.exec(SHARE_SCRIPT, host, threads);
            if (pid > 0) {
                const action = runningThreads > 0 ? "scaled" : "started";
                ns.print(`[Share] ${SHARE_SCRIPT} on ${host} with ${threads} thread(s) ${action}.`);
            }
        }
    }

    function safeGrowthThreads(target, multiplier) {
        const growMult = Number.isFinite(multiplier) ? multiplier : Number(multiplier);
        if (!Number.isFinite(growMult) || growMult < 1) {
            ns.print(`[Warn] safeGrowthThreads: invalid growMult=${multiplier} for ${target}, setting to 1`);
            return 1;
        }
        return Math.max(1, Math.ceil(ns.growthAnalyze(target, growMult)));
    }

    // ── HWGW calculations ────────────────────────────────────────────────────

    /**
     * Calculate thread counts for a HWGW batch.
     * Assumption: target is at minSec + maxMoney (prepared).
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

        // growthAnalyze returns the minimum thread count to reach at least the given factor.
        // The engine itself can cap the result at maxMoney.
        const growMult = 1 / (1 - stoleFrac);
        const growThreads = safeGrowthThreads(target, growMult);

        const wPer = ns.weakenAnalyze(1);
        const w1Threads = Math.max(1, Math.ceil(ns.hackAnalyzeSecurity(hackThreads) / wPer));
        const w2Threads = Math.max(1, Math.ceil(ns.growthAnalyzeSecurity(growThreads) / wPer));

        return { hackThreads, growThreads, w1Threads, w2Threads };
    }

    /** Total RAM requirement of a batch in GB */
    function batchRam(b) {
        return b.hackThreads * ns.getScriptRam(H_SCRIPT, "home")
             + b.growThreads * ns.getScriptRam(G_SCRIPT, "home")
             + (b.w1Threads + b.w2Threads) * ns.getScriptRam(W_SCRIPT, "home");
    }

    // ── State check ──────────────────────────────────────────────────────────

    function isReady(target) {
        return ns.getServerSecurityLevel(target) <= ns.getServerMinSecurityLevel(target) + 0.5
            && ns.getServerMoneyAvailable(target) >= ns.getServerMaxMoney(target) * MIN_MONEY_FRAC;
    }

    // ── Preparation ─────────────────────────────────────────────────────────

    /**
     * Starts weaken/grow scripts to bring a server to minSec + maxMoney.
     * Non-blocking – scripts run in the background.
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

    // ── Launch HWGW batch ───────────────────────────────────────────────────

    /**
     * Launches a complete HWGW batch for `target`.
     *
     * Timing concept (finish order: H → W1 → G → W2):
     *   W1 starts immediately  (reference, finish = weakenTime)
     *   H  starts with delay = weakenTime - hackTime   - SPACING
     *   G  starts with delay = weakenTime - growTime   + SPACING
     *   W2 starts with delay = 2 * SPACING
     *
     * uid prevents ns.exec() from rejecting duplicate scripts.
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

        // Binary search: maximum fraction that still fits in RAM
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

        // Launch all 4 operations – uid as last arg so PIDs are unique
        return distribute(ramList, W_SCRIPT, batch.w1Threads,  target, delay_W1, uid + "w1")
            && distribute(ramList, H_SCRIPT, batch.hackThreads, target, delay_H,  uid + "h")
            && distribute(ramList, G_SCRIPT, batch.growThreads, target, delay_G,  uid + "g")
            && distribute(ramList, W_SCRIPT, batch.w2Threads,  target, delay_W2, uid + "w2");
    }

    // ── Profitability ───────────────────────────────────────────────────────

    /** Sort targets by expected profit rate (highest first) */
    function sortByProfit(targets) {
        return [...targets].sort((a, b) => {
            const rate = t => ns.getServerMaxMoney(t)
                             * ns.hackAnalyze(t)
                             * HACK_FRACTION
                             / ns.getWeakenTime(t);
            return rate(b) - rate(a);
        });
    }

    // ── Buy / create programs (requires Singularity SF4) ─────────────────

    /**
     * Buys missing port crackers from the darkweb shop or programs them.
     * Protected by try/catch – without SF4 the script simply continues.
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

            // Buy TOR router (required for darkweb purchases)
            ns.singularity.purchaseTor();

            // Buy programs if enough money is available
            for (const prog of missing) {
                if (ns.singularity.purchaseProgram(prog)) {
                    ns.tprint(`[Prog] Purchased: ${prog}`);
                }
            }

            // Write still-missing programs manually
            const stillMissing = programs.filter(p => !ns.fileExists(p, "home"));
            if (stillMissing.length === 0) return;

            const currentWork = ns.singularity.getCurrentWork();
            const alreadyCoding = currentWork !== null && currentWork.type === "CREATE_PROGRAM";
            if (!alreadyCoding) {
                if (ns.singularity.createProgram(stillMissing[0], false)) {
                    ns.print(`[Prog] Writing: ${stillMissing[0]}`);
                }
            }
        } catch (_) {
            // Singularity API not available (no SF4) – ignored
        }
    }

    // ── Main loop ────────────────────────────────────────────────────────────

    // ── One-time initialization ────────────────────────────────────────────

    /** Stop foreign scripts on runners; worker scripts are kept */
    async function initRunners(runners) {
        const workerScripts = new Set([H_SCRIPT, G_SCRIPT, W_SCRIPT, SHARE_SCRIPT]);
        let killed = false;
        for (const r of runners) {
            if (r === "home") continue;
            for (const proc of ns.ps(r)) {
                if (!workerScripts.has(proc.filename)) {
                    ns.kill(proc.pid);
                    ns.print(`[Init] Killed: ${proc.filename} on ${r}`);
                    killed = true;
                }
            }
        }
        if (killed) await ns.sleep(200);
        // Copy worker scripts to all runners
        const scripts = [H_SCRIPT, G_SCRIPT, W_SCRIPT, SHARE_SCRIPT];
        for (const r of runners) {
            if (r !== "home") await ns.scp(scripts, r);
        }
        ensureShareOnRunners(runners);
    }

    ns.tprint("Auto-Hack Manager started.");

    // One-time at startup: clear MyServer_
    {
        const initServers = scanAll().filter(isRunner);
        await initRunners(initServers);
    }

    let uid = 0;

    while (true) {
        manageProgramAcquisition();

        const allServers = scanAll();

        // Try to gain root access on all not-yet-hacked servers
        for (const s of allServers) {
            if (!ns.hasRootAccess(s)) tryNuke(s);
        }

        const runners = allServers.filter(isRunner);
        const targets = allServers.filter(isTarget);

        // Copy worker scripts to new runners (already running ones stay)
        await scpToRunners(runners);
        ensureShareOnRunners(runners);

        const ramList = runnerRamList(runners);
        let batched = 0;
        let prepping = 0;
        let noRam = 0;

        const sortedTargets = sortByProfit(targets);
        const readyTargets  = sortedTargets.filter(isReady);
        const notReady      = sortedTargets.filter(t => !isReady(t));

        // Preparation for servers that are not yet ready
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

        // Round-robin: every ready target gets a batch in turn,
        // until no RAM is left for any batch.
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

        // Status display in log
        const totalFree = ramList.reduce((s, r) => s + r.free, 0).toFixed(1);
        const ready = targets.filter(isReady).length;
        ns.clearLog();
        ns.print("╔══════════════════════════════╗");
        ns.print(`║  Auto-Hack Manager           ║`);
        ns.print("╠══════════════════════════════╣");
        ns.print(`║  Targets:      ${String(targets.length).padStart(4)}           ║`);
        ns.print(`║  Ready:        ${String(ready).padStart(4)}           ║`);
        ns.print(`║  Preparing:    ${String(prepping).padStart(4)}           ║`);
        ns.print(`║  Batches lnch: ${String(batched).padStart(4)}           ║`);
        ns.print(`║  No RAM:       ${String(noRam).padStart(4)}           ║`);
        ns.print(`║  Runners:      ${String(runners.length).padStart(4)}           ║`);
        ns.print(`║  Free RAM:     ${String(totalFree).padStart(7)} GB       ║`);
        ns.print(`║  Batch cap:    ${(cycleCapped ? "YES" : "no").padStart(4)}           ║`);
        ns.print("╠══════════════════════════════╣");
        // RAM pro Runner anzeigen (Top 10)
        const displayList = ramList.slice(0, 10);
        for (const r of displayList) {
            const label = r.host.length > 14 ? r.host.slice(0, 14) : r.host.padEnd(14);
            ns.print(`║  ${label}  ${String(r.free.toFixed(0)).padStart(5)} GB       ║`);
        }
        if (ramList.length > 10) {
            ns.print(`║  ... +${String(ramList.length - 10).padStart(2)} more runners               ║`);
        }
        ns.print("╚══════════════════════════════╝");

        await ns.sleep(LOOP_DELAY);
    }
}


