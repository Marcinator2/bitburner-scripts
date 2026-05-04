/** @param {NS} ns */
// bootstrap.js — Phase-based launcher for a fresh start on 8 GB home.
//
// Phase 1: Hack n00dles (inline, minimal RAM) + hacknet node buying (inline)
// Phase 2: SF4 available → launch auto-leveler.js + manager_hacknet.js
// Phase 3: Enough RAM on home → launch auto-hack-manager.js + manager_server.js
// Phase 4: main_manager.js is running → self-terminate
//
// The script kills itself once main_manager.js takes over (Phase 4).
// Re-run it manually if you want to restart the bootstrap chain.

export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  const LOOP_MS            = 10_000;
  const HACK_TARGET        = "n00dles";
  const HACK_SCRIPT        = "money-hack.js";
  const HACKNET_SCRIPT     = "manager_hacknet.js";
  const LEVELER_SCRIPT     = "auto-leveler.js";
  const HACK_MANAGER       = "auto-hack-manager.js";
  const SERVER_MANAGER     = "manager_server.js";
  const MAIN_MANAGER       = "main_manager.js";
  const HACK_MANAGER_RAM   = 8;   // GB required on home to start auto-hack-manager
  const SERVER_MANAGER_RAM = 4;   // GB required on home to start manager_server
  const HOME               = "home";

  ns.tprint("bootstrap.js started.");

  while (true) {
    ns.clearLog();
    const homeRam     = ns.getServerMaxRam(HOME);
    const homeRamUsed = ns.getServerUsedRam(HOME);
    const homeFreeRam = homeRam - homeRamUsed;
    const money       = ns.getPlayer().money;
    const hackLevel   = ns.getHackingLevel();
    const hasSF4      = !!ns.singularity;

    // --- Phase 4: main_manager is running → hand off and exit ---
    if (ns.scriptRunning(MAIN_MANAGER, HOME)) {
      ns.tprint("bootstrap.js: main_manager.js is running. Bootstrap complete. Terminating.");
      return;
    }

    ns.print(`[bootstrap] RAM: ${homeRamUsed.toFixed(1)}/${homeRam} GB free | Money: ${ns.format.number(money)} | Hack: ${hackLevel} | SF4: ${hasSF4}`);

    // --- Phase 1a: Study Computer Science whenever idle (SF4 only) ---
    if (hasSF4) {
      // Hack courses at Rothman University (Sector-12), sorted best to cheapest.
      // Base costs from source (money/s) × Rothman costMult 3.
      const HACK_COURSES = [
        { name: "Algorithms",             classType: "Algorithms",        costPerSec: 960 },
        { name: "Networks",               classType: "Networks",          costPerSec: 240 },
        { name: "Data Structures",        classType: "Data Structures",   costPerSec: 120 },
        { name: "Study Computer Science", classType: "Computer Science",  costPerSec: 0   },
      ];

      // Sum up hacknet production ($/s)
      let hacknetIncome = 0;
      const numNodes = ns.hacknet.numNodes?.() ?? 0;
      for (let i = 0; i < numNodes; i++) {
        try { hacknetIncome += ns.hacknet.getNodeStats(i).production; } catch (_) {}
      }

      const bestCourse = HACK_COURSES.find(c => hacknetIncome >= c.costPerSec)
        ?? HACK_COURSES[HACK_COURSES.length - 1];

      let currentWork = null;
      try { currentWork = ns.singularity.getCurrentWork(); } catch (_) {}

      const HACK_CLASS_TYPES = new Set(HACK_COURSES.map(c => c.classType));
      const currentClassType = currentWork?.classType ?? "";
      const isStudyingHack   = currentWork?.type === "CLASS" && HACK_CLASS_TYPES.has(currentClassType);
      const isOnBestCourse   = isStudyingHack && currentClassType === bestCourse.classType;
      const isIdle           = currentWork === null;

      if (isIdle || (isStudyingHack && !isOnBestCourse)) {
        try {
          ns.singularity.universityCourse("Rothman University", bestCourse.name, false);
          ns.print(`[Phase 1] Study: ${bestCourse.name} (hacknet: ${ns.format.number(hacknetIncome)}/s, hack ${hackLevel}).`);
        } catch (_) {}
      } else if (isOnBestCourse) {
        ns.print(`[Phase 1] Studying ${bestCourse.name} (hack ${hackLevel}, hacknet: ${ns.format.number(hacknetIncome)}/s).`);
      } else {
        ns.print(`[Phase 1] Working: ${currentWork?.type} – not interrupting for study.`);
      }
    }

    // --- Phase 1c: Start a simple hack loop on n00dles if nothing else is hacking ---
    const hackRunning = ns.scriptRunning(HACK_SCRIPT, HOME)
      || ns.scriptRunning(HACK_MANAGER, HOME);
    if (!hackRunning && ns.fileExists(HACK_SCRIPT, HOME)) {
      const targetHackLevel = ns.getServerRequiredHackingLevel(HACK_TARGET);
      if (hackLevel >= targetHackLevel) {
        // Estimate RAM needed for money-hack.js (Bitburner charges at exec time)
        const scriptRam = ns.getScriptRam(HACK_SCRIPT, HOME);
        if (homeFreeRam >= scriptRam) {
          ns.exec(HACK_SCRIPT, HOME, 1, HACK_TARGET);
          ns.print(`[Phase 1] Started ${HACK_SCRIPT} targeting ${HACK_TARGET}`);
        }
      }
    }

    // --- Phase 1d: Buy first hacknet node if affordable and none exist ---
    if (ns.hacknet && ns.hacknet.numNodes() === 0) {
      const nodeCost = ns.hacknet.getPurchaseNodeCost();
      if (money >= nodeCost) {
        ns.hacknet.purchaseNode();
        ns.print("[Phase 1] Bought first hacknet node.");
      }
    }

    // --- Phase 2: SF4 available → launch auto-leveler and hacknet manager ---
    if (hasSF4) {
      if (ns.fileExists(LEVELER_SCRIPT, HOME) && !ns.scriptRunning(LEVELER_SCRIPT, HOME)) {
        const ram = ns.getScriptRam(LEVELER_SCRIPT, HOME);
        if (homeFreeRam >= ram) {
          ns.exec(LEVELER_SCRIPT, HOME, 1);
          ns.print(`[Phase 2] Started ${LEVELER_SCRIPT}`);
        }
      }

      if (ns.fileExists(HACKNET_SCRIPT, HOME) && !ns.scriptRunning(HACKNET_SCRIPT, HOME)) {
        const ram = ns.getScriptRam(HACKNET_SCRIPT, HOME);
        if (homeFreeRam >= ram) {
          ns.exec(HACKNET_SCRIPT, HOME, 1);
          ns.print(`[Phase 2] Started ${HACKNET_SCRIPT}`);
        }
      }
    }

    // --- Phase 3: Enough RAM → launch auto-hack-manager and server manager ---
    // Kill simple money-hack.js first if auto-hack-manager is about to take over
    if (ns.fileExists(HACK_MANAGER, HOME) && !ns.scriptRunning(HACK_MANAGER, HOME)) {
      const ram = ns.getScriptRam(HACK_MANAGER, HOME);
      if (homeRam >= HACK_MANAGER_RAM && homeFreeRam >= ram) {
        ns.scriptKill(HACK_SCRIPT, HOME);
        await ns.sleep(500);
        ns.exec(HACK_MANAGER, HOME, 1);
        ns.print(`[Phase 3] Started ${HACK_MANAGER} (replaced ${HACK_SCRIPT})`);
      }
    }

    if (ns.fileExists(SERVER_MANAGER, HOME) && !ns.scriptRunning(SERVER_MANAGER, HOME)) {
      const ram = ns.getScriptRam(SERVER_MANAGER, HOME);
      if (homeRam >= SERVER_MANAGER_RAM && homeFreeRam >= ram) {
        ns.exec(SERVER_MANAGER, HOME, 1);
        ns.print(`[Phase 3] Started ${SERVER_MANAGER}`);
      }
    }

    // --- Phase 3b: Suggest upgrading home / starting main_manager once RAM grows ---
    const allPhasesRunning = ns.scriptRunning(HACK_MANAGER, HOME)
      && ns.scriptRunning(SERVER_MANAGER, HOME)
      && (!hasSF4 || (ns.scriptRunning(LEVELER_SCRIPT, HOME) && ns.scriptRunning(HACKNET_SCRIPT, HOME)));

    if (allPhasesRunning) {
      ns.print(`[bootstrap] All phase scripts running. Start main_manager.js manually when ready, or upgrade home RAM first.`);
    }

    await ns.sleep(LOOP_MS);
  }
}
