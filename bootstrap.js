/** @param {NS} ns */
// bootstrap.js — Phase-based launcher for a fresh start on 8 GB home.
//
// Phase 1:   Hack n00dles (inline, minimal RAM)
// Phase 1e:  Launch bootstrap_hacknet.js (buys first node, when RAM allows)
// Phase 1f:  Buy cloud servers inline (cloud API, ~4 GB extra)
// Phase 2:   SF4 → bootstrap_study.js + auto-leveler.js + manager_hacknet.js + bootstrap_home_upgrade.js
// Phase 2.5: Launch 1st-hackworm.js when workers exist
// Phase 3:   Launch auto-hack-manager.js; manager_server.js if RAM allows
// Phase 4:   main_manager.js running → self-terminate
//
// Server buying is done inline (Phase 1f) so it works even when RAM is tight.
// bootstrap_home_upgrade.js only launches when it actually fits in RAM (SF4 L3+).

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
  const HOME_UPGRADE_SCRIPT= "bootstrap_home_upgrade.js";
  const HACKWORM_SCRIPT    = "1st-hackworm.js";
  const HACK_MANAGER       = "auto-hack-manager.js";
  const SERVER_MANAGER     = "manager_server.js";
  const MAIN_MANAGER       = "main_manager.js";
  const HACKWORM_WORKERS   = ["v_hack.js", "v_grow.js", "v_weaken.js"];
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
    const hackingActive = ns.scriptRunning(HACK_SCRIPT, HOME)
      || ns.scriptRunning(HACKWORM_SCRIPT, HOME)
      || ns.scriptRunning(HACK_MANAGER, HOME);
    const hackReserve   = hackingActive ? 0 : ns.getScriptRam(HACK_SCRIPT, HOME);
    const canLaunch     = (script) => homeFreeRam - ns.getScriptRam(script, HOME) >= hackReserve;

    // --- Phase 4: main_manager is running → hand off and exit ---
    if (ns.scriptRunning(MAIN_MANAGER, HOME)) {
      ns.tprint("bootstrap.js: main_manager.js is running. Bootstrap complete. Terminating.");
      return;
    }

    ns.print(`[bootstrap] RAM: ${homeRamUsed.toFixed(1)}/${homeRam} GB used | Hack: ${hackLevel} | SF4: ${hasSF4} | Reserve: ${hackReserve.toFixed(1)} GB`);

    // --- Phase 1e: Launch hacknet bootstrap helper when RAM allows and no nodes exist yet ---
    if (ns.hacknet.numNodes() === 0
        && ns.fileExists(HACKNET_BOOT, HOME) && !ns.scriptRunning(HACKNET_BOOT, HOME)
        && !ns.scriptRunning(HACKNET_SCRIPT, HOME)) {
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

    // --- Phase 1f: Buy cloud servers inline (no sub-script needed) ---
    if (!ns.scriptRunning(SERVER_MANAGER, HOME)) {
      const purchased  = ns.cloud.getServerNames();
      const limit      = ns.cloud.getServerLimit();
      const money      = ns.getPlayer().money;
      if (purchased.length < limit) {
        const cost = ns.cloud.getServerCost(8);
        if (cost > 0 && money >= cost * 1.1) {
          const name = `MyServer_${purchased.length}`;
          const result = ns.cloud.purchaseServer(name, 8);
          if (result) ns.print(`[Phase 1f] Bought ${result} (8 GB) for ${ns.format.number(cost)}`);
        } else if (cost > 0) {
          ns.print(`[Phase 1f] Servers: ${purchased.length}/${limit} | Next 8 GB: ${ns.format.number(cost)}`);
        }
      } else {
        ns.print(`[Phase 1f] Server slots full (${purchased.length}/${limit}).`);
      }
    }

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

      if (ns.fileExists(HOME_UPGRADE_SCRIPT, HOME) && !ns.scriptRunning(HOME_UPGRADE_SCRIPT, HOME)) {
        if (canLaunch(HOME_UPGRADE_SCRIPT)) {
          ns.exec(HOME_UPGRADE_SCRIPT, HOME, 1);
          ns.print(`[Phase 2] Started ${HOME_UPGRADE_SCRIPT}`);
        }
      }
    }

    // --- Phase 2.5: Launch 1st-hackworm.js if workers exist and RAM allows ---
    // Replaces money-hack.js; itself gets replaced by auto-hack-manager.js in Phase 3.
    const hackwormRunning   = ns.scriptRunning(HACKWORM_SCRIPT, HOME);
    const hackwormWorkersOk = HACKWORM_WORKERS.every(w => ns.fileExists(w, HOME));
    if (!hackwormRunning && !ns.scriptRunning(HACK_MANAGER, HOME)
        && hackwormWorkersOk && ns.fileExists(HACKWORM_SCRIPT, HOME)) {
      if (canLaunch(HACKWORM_SCRIPT)) {
        ns.scriptKill(HACK_SCRIPT, HOME);
        await ns.sleep(200);
        const pid = ns.exec(HACKWORM_SCRIPT, HOME, 1);
        if (pid > 0) ns.print(`[Phase 2.5] Started ${HACKWORM_SCRIPT} (replaced ${HACK_SCRIPT})`);
      }
    }

    // --- Phase 3: Enough RAM → launch auto-hack-manager and server manager ---
    // Kill simple money-hack.js first if auto-hack-manager is about to take over
    if (ns.fileExists(HACK_MANAGER, HOME) && !ns.scriptRunning(HACK_MANAGER, HOME)) {
      const ram = ns.getScriptRam(HACK_MANAGER, HOME);
      if (homeRam >= HACK_MANAGER_RAM && homeFreeRam >= ram) {
        ns.scriptKill(HACK_SCRIPT, HOME);
        await ns.sleep(500);
        const pid = ns.exec(HACK_MANAGER, HOME, 1);
        ns.print(pid > 0 ? `[Phase 3] Started ${HACK_MANAGER}` : `[Phase 3] FAILED to start ${HACK_MANAGER} (not enough RAM?)`);
      }
    }

    if (ns.fileExists(SERVER_MANAGER, HOME) && !ns.scriptRunning(SERVER_MANAGER, HOME)) {
      const ram = ns.getScriptRam(SERVER_MANAGER, HOME);
      if (homeRam >= SERVER_MANAGER_RAM && homeFreeRam >= ram) {
        const pid = ns.exec(SERVER_MANAGER, HOME, 1);
        ns.print(pid > 0 ? `[Phase 3] Started ${SERVER_MANAGER}` : `[Phase 3] FAILED to start ${SERVER_MANAGER} (not enough RAM?)`);
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
