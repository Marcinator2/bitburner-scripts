// STATUS: Legacy hacking manager. Not currently referenced by main_manager.
// Kept for comparison or fallback; maintain new hacking logic in auto-hack-manager.js.
/** @param {NS} ns */

//dd1

export async function main(ns) {
  ns.disableLog("ALL");

  const WORKERS = ["v_hack.js", "v_grow.js", "v_weaken.js"];
  const LOOP_DELAY = 10000;
  const SECURITY_MARGIN = 3;
  const MONEY_RATIO = 0.2; // grow below this threshold
  const MIN_RAM_TO_RUN = 1;

  if (!WORKERS.every(script => ns.fileExists(script, "home"))) {
    print("❌ Missing worker scripts on home. Please place v_hack.js, v_grow.js and v_weaken.js on home.");
    return;
  }

  const RAM_COST = {
    hack: ns.getScriptRam("v_hack.js", "home"),
    grow: ns.getScriptRam("v_grow.js", "home"),
    weaken: ns.getScriptRam("v_weaken.js", "home"),
  };

  const print = () => {};

  function scanAllServers() {
    const visited = new Set(["home"]);
    const queue = ["home"];
    while (queue.length) {
      const host = queue.shift();
      for (const neighbor of ns.scan(host)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    return [...visited];
  }

  function portToolsCount() {
    return [
      "BruteSSH.exe",
      "FTPCrack.exe",
      "relaySMTP.exe",
      "HTTPWorm.exe",
      "SQLInject.exe",
    ].filter(tool => ns.fileExists(tool, "home")).length;
  }

  function getHostSafetyReserve(host) {
    if (host === "home") return ns.getScriptRam(ns.getScriptName(), "home"); // reserve only the manager's own RAM
    const maxRam = ns.getServerMaxRam(host);
    return maxRam >= 32 ? Math.ceil(maxRam * 0.1) : 0;
  }

  function availableRam(host) {
    const max = ns.getServerMaxRam(host);
    const used = ns.getServerUsedRam(host);
    return Math.max(0, max - used - getHostSafetyReserve(host));
  }

  function canNuke(host) {
    if (ns.hasRootAccess(host)) return true;
    if (ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel()) return false;
    return portToolsCount() >= ns.getServerNumPortsRequired(host);
  }

  function tryNuke(host) {
    if (ns.hasRootAccess(host)) return true;
    if (!canNuke(host)) return false;

    if (ns.fileExists("BruteSSH.exe", "home")) ns.brutessh(host);
    if (ns.fileExists("FTPCrack.exe", "home")) ns.ftpcrack(host);
    if (ns.fileExists("relaySMTP.exe", "home")) ns.relaysmtp(host);
    if (ns.fileExists("HTTPWorm.exe", "home")) ns.httpworm(host);
    if (ns.fileExists("SQLInject.exe", "home")) ns.sqlinject(host);

    if (portToolsCount() >= ns.getServerNumPortsRequired(host)) {
      ns.nuke(host);
      ns.tprint(`🔓 Nuke successful: ${host}`);
      return true;
    }
    return false;
  }

  function isHackTarget(host) {
    if (host === "home") return false;
    if (ns.getServerMaxMoney(host) <= 0) return false;
    if (ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel()) return false;
    return true;
  }

  function chooseTargets(servers, count = 3) {
    return servers
      .filter(host => ns.hasRootAccess(host) && isHackTarget(host))
      .sort((a, b) => {
        const score = host => ns.getServerMaxMoney(host) * ns.hackAnalyze(host) / ns.getWeakenTime(host);
        return score(b) - score(a);
      })
      .slice(0, count);
  }

  function findRunners(servers) {
    return servers
      .filter(host => ns.hasRootAccess(host) && availableRam(host) >= MIN_RAM_TO_RUN)
      .sort((a, b) => availableRam(b) - availableRam(a));
  }

  function needWeaken(host) {
    return ns.getServerSecurityLevel(host) > ns.getServerMinSecurityLevel(host) + SECURITY_MARGIN;
  }

  function needGrow(host) {
    return ns.getServerMoneyAvailable(host) < ns.getServerMaxMoney(host) * MONEY_RATIO;
  }

  function runWorker(host, script, threads, target) {
    if (threads <= 0) return false;
    const pid = ns.exec(script, host, threads, target, 0);
    if (pid > 0) {
      ns.tprint(`🚀 ${script} started on ${host}: ${threads} threads for ${target}`);
      return true;
    }
    return false;
  }

  async function ensureWorkerScripts(host) {
    if (host === "home") return true;
    return await ns.scp(WORKERS, host);
  }

  while (true) {
    const servers = scanAllServers();

    for (const host of servers) {
      if (!isHackTarget(host) || ns.hasRootAccess(host)) continue;
      if (canNuke(host)) {
        tryNuke(host);
      }
    }

    const targets = chooseTargets(servers, 3);
    if (targets.length === 0) {
      print("ℹ️ No suitable targets found. Rescanning...");
      await ns.sleep(LOOP_DELAY);
      continue;
    }

    const runners = findRunners(servers);
    if (runners.length === 0) {
      print("⚠️ No free runners with available RAM found.");
      await ns.sleep(LOOP_DELAY);
      continue;
    }

    for (const runner of runners) {
      if (!await ensureWorkerScripts(runner)) {
        print(`❌ Worker scripts could not be copied to ${runner}.`);
        continue;
      }

      const free = availableRam(runner);
      if (free < Math.min(RAM_COST.hack, RAM_COST.grow, RAM_COST.weaken)) continue;

      const target = targets.find(t => needWeaken(t) && free >= RAM_COST.weaken)
        || targets.find(t => needGrow(t) && free >= RAM_COST.grow)
        || targets[0];

      let script = "v_hack.js";
      let cost = RAM_COST.hack;

      if (needWeaken(target) && free >= RAM_COST.weaken) {
        script = "v_weaken.js";
        cost = RAM_COST.weaken;
      } else if (needGrow(target) && free >= RAM_COST.grow) {
        script = "v_grow.js";
        cost = RAM_COST.grow;
      }

      const threads = Math.max(1, Math.floor(free / cost));
      runWorker(runner, script, threads, target);
    }

    await ns.sleep(LOOP_DELAY);
  }
}
