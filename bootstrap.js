/** @param {NS} ns */
// bootstrap.js — Phase-based launcher for a fresh start on 8 GB home.
//
// Phase 1: Hack n00dles (inline, minimal RAM)
// Phase 1e: Launch bootstrap_hacknet.js (buys first node, ~3.6 GB, when RAM allows)
// Phase 2: SF4 available → launch bootstrap_study.js + auto-leveler.js + manager_hacknet.js
// Phase 3: Enough RAM on home → launch auto-hack-manager.js + manager_server.js
// Phase 4: main_manager.js is running → self-terminate
//
// RAM budget: ~5.35 GB (no hacknet API, no singularity API calls)
// Sub-scripts are only launched when homeFreeRam >= scriptRam + hackReserve.
// hackReserve = money-hack.js RAM, unless hacking is already running (then 0).

export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();

  const LOOP_MS            = 10_000;
  const HACK_TARGET        = "n00dles";
  const HACK_SCRIPT        = "money-hack.js";
  const HACKNET_SCRIPT     = "manager_hacknet.js";
  const HACKNET_BOOT       = "bootstrap_hacknet.js";
  const LEVELER_SCRIPT     = "auto-leveler.js";
  const STUDY_SCRIPT       = "bootstrap_study.js";
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
    const hackLevel   = ns.getHackingLevel();
    const hasSF4      = !!ns.singularity;

    // RAM reserve: keep enough free for money-hack.js unless hacking is already running
    const hackingActive = ns.scriptRunning(HACK_SCRIPT, HOME) || ns.scriptRunning(HACK_MANAGER, HOME);
    const hackReserve   = hackingActive ? 0 : ns.getScriptRam(HACK_SCRIPT, HOME);
    const canLaunch     = (script) => homeFreeRam - ns.getScriptRam(script, HOME) >= hackReserve;

    // --- Phase 4: main_manager is running → hand off and exit ---
    if (ns.scriptRunning(MAIN_MANAGER, HOME)) {
      ns.tprint("bootstrap.js: main_manager.js is running. Bootstrap complete. Terminating.");
      return;
    }

    ns.print(`[bootstrap] RAM: ${homeRamUsed.toFixed(1)}/${homeRam} GB used | Hack: ${hackLevel} | SF4: ${hasSF4} | Reserve: ${hackReserve.toFixed(1)} GB`);

    // --- Phase 1e: Launch hacknet bootstrap helper when RAM allows ---
    if (ns.fileExists(HACKNET_BOOT, HOME) && !ns.scriptRunning(HACKNET_BOOT, HOME) && !ns.scriptRunning(HACKNET_SCRIPT, HOME)) {
      if (canLaunch(HACKNET_BOOT)) {
        ns.exec(HACKNET_BOOT, HOME, 1);
        ns.print(`[Phase 1e] Started ${HACKNET_BOOT}`);
      }
    }

    // --- Phase 1c: Start a simple hack loop on n00dles if nothing else is hacking ---
    if (!hackingActive && ns.fileExists(HACK_SCRIPT, HOME)) {
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

    // --- Phase 1d: (moved to bootstrap_hacknet.js) ---

    // --- Phase 2: SF4 available → launch study helper, auto-leveler and hacknet manager ---
    if (hasSF4) {
      if (ns.fileExists(STUDY_SCRIPT, HOME) && !ns.scriptRunning(STUDY_SCRIPT, HOME)) {
        if (canLaunch(STUDY_SCRIPT)) {
          ns.exec(STUDY_SCRIPT, HOME, 1);
          ns.print(`[Phase 2] Started ${STUDY_SCRIPT}`);
        }
      }

      if (ns.fileExists(LEVELER_SCRIPT, HOME) && !ns.scriptRunning(LEVELER_SCRIPT, HOME)) {
        if (canLaunch(LEVELER_SCRIPT)) {
          ns.exec(LEVELER_SCRIPT, HOME, 1);
          ns.print(`[Phase 2] Started ${LEVELER_SCRIPT}`);
        }
      }

      if (ns.fileExists(HACKNET_SCRIPT, HOME) && !ns.scriptRunning(HACKNET_SCRIPT, HOME)) {
        if (canLaunch(HACKNET_SCRIPT)) {
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
