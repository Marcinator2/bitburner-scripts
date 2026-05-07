/** @param {NS} ns */

// manager_root.js
// Scans all reachable servers and gains root access where possible.
// Runs as a standalone service – does not require the hack manager.

export async function main(ns) {
  ns.disableLog("ALL");

  const DEFAULT_LOOP_MS = 30_000;
  let loopMs = DEFAULT_LOOP_MS;
  try {
    const cfgRaw = ns.read("main_manager_config.js");
    if (cfgRaw) loopMs = Number(JSON.parse(cfgRaw)?.services?.root?.loopMs) || DEFAULT_LOOP_MS;
  } catch { /* use fallback */ }

  const PORT_CRACKERS = [
    { file: "BruteSSH.exe",  fn: s => ns.brutessh(s) },
    { file: "FTPCrack.exe",  fn: s => ns.ftpcrack(s) },
    { file: "relaySMTP.exe", fn: s => ns.relaysmtp(s) },
    { file: "HTTPWorm.exe",  fn: s => ns.httpworm(s) },
    { file: "SQLInject.exe", fn: s => ns.sqlinject(s) },
  ];

  function scanAll() {
    const found = new Set(["home"]);
    const queue = ["home"];
    while (queue.length) {
      for (const s of ns.scan(queue.shift())) {
        if (!found.has(s)) { found.add(s); queue.push(s); }
      }
    }
    return [...found];
  }

  function tryRoot(server) {
    if (ns.hasRootAccess(server)) return false;
    const reqPorts = ns.getServerNumPortsRequired(server);
    const hackLevel = ns.getHackingLevel();
    if (ns.getServerRequiredHackingLevel(server) > hackLevel) return false;

    let openPorts = 0;
    for (const cracker of PORT_CRACKERS) {
      if (ns.fileExists(cracker.file, "home")) {
        cracker.fn(server);
        openPorts++;
      }
    }

    if (openPorts >= reqPorts) {
      ns.nuke(server);
      if (ns.hasRootAccess(server)) {
        ns.tprint(`[Root] Access gained: ${server}`);
        return true;
      }
    }
    return false;
  }

  while (true) {
    const all = scanAll();
    const owned = new Set(ns.cloud.getServerNames());
    let newRoots = 0;
    for (const s of all) {
      if (s === "home" || owned.has(s)) continue;
      if (tryRoot(s)) newRoots++;
    }
    if (newRoots > 0) {
      ns.print(`Rooted ${newRoots} new server(s).`);
    }
    await ns.sleep(loopMs);
  }
}
