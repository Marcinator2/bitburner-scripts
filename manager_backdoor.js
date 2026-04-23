/** @param {NS} ns */

// manager_backdoor.js
// Installs backdoors on all reachable servers (requires Singularity SF4).
// Runs as a standalone service – does not block the hack manager.

export async function main(ns) {
  ns.disableLog("ALL");

  if (typeof ns.singularity?.installBackdoor !== "function") {
    ns.tprint("ERROR: Singularity API not available (SF4 required).");
    return;
  }

  const LOOP_DELAY_MS = 30_000; // Pause between full passes

  /** BFS path from 'home' to 'target' */
  function findPath(target) {
    const parent = new Map([["home", null]]);
    const queue = ["home"];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === target) {
        const path = [];
        let node = cur;
        while (node !== null) { path.unshift(node); node = parent.get(node); }
        return path;
      }
      for (const nb of ns.scan(cur)) {
        if (!parent.has(nb)) { parent.set(nb, cur); queue.push(nb); }
      }
    }
    return null;
  }

  /** All servers via BFS */
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

  while (true) {
    // Always return to home at the start of each pass (safety net if script was killed mid-run)
    try { ns.singularity.connect("home"); } catch (_) {}

    const allServers = scanAll();
    const hackLevel = ns.getHackingLevel();
    const purchasedSet = new Set(ns.getPurchasedServers());

    // Candidates: root access, hack level ok, no backdoor yet, not a player server
    const candidates = allServers.filter(s =>
      s !== "home"
      && !purchasedSet.has(s)
      && ns.hasRootAccess(s)
      && ns.getServerRequiredHackingLevel(s) <= hackLevel
      && !ns.getServer(s).backdoorInstalled
    );

    // Shortest hack time first → minimize wait time
    candidates.sort((a, b) => ns.getHackTime(a) - ns.getHackTime(b));

    ns.clearLog();
    ns.print(`[Backdoor] ${candidates.length} servers open. Starting...`);

    for (const target of candidates) {
      const path = findPath(target);
      if (!path) continue;

      try {
        for (const hop of path.slice(1)) ns.singularity.connect(hop);
        ns.print(`[Backdoor] Installing on: ${target} (${ns.tFormat(ns.getHackTime(target))})`);
        await ns.singularity.installBackdoor();
        ns.print(`[Backdoor] ✓ ${target}`);
      } catch (e) {
        ns.print(`[Backdoor] Error on ${target}: ${e}`);
      } finally {
        try { ns.singularity.connect("home"); } catch (_) {}
      }
    }

    const done = allServers.filter(s =>
      s !== "home" && !purchasedSet.has(s) && ns.getServer(s).backdoorInstalled
    ).length;
    ns.clearLog();
    ns.print(`[Backdoor] Done. Installed: ${done} | Open: ${candidates.length}`);
    ns.print(`[Backdoor] Next pass in ${LOOP_DELAY_MS / 1000}s`);

    await ns.sleep(LOOP_DELAY_MS);
  }
}
