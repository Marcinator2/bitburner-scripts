/** @param {NS} ns */

// manager_backdoor.js
// Installiert Backdoors auf allen erreichbaren Servern (benötigt Singularity SF4).
// Läuft als eigenständiger Service – blockiert nicht den Hack-Manager.

export async function main(ns) {
  ns.disableLog("ALL");

  if (typeof ns.singularity?.installBackdoor !== "function") {
    ns.tprint("FEHLER: Singularity API nicht verfügbar (SF4 benötigt).");
    return;
  }

  const LOOP_DELAY_MS = 30_000; // Pause zwischen vollständigen Durchläufen

  /** BFS-Pfad von 'home' zu 'target' */
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

  /** Alle Server per BFS */
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
    const allServers = scanAll();
    const hackLevel = ns.getHackingLevel();

    // Kandidaten: Root-Access, Hack-Level ok, noch kein Backdoor, kein eigener Server
    const candidates = allServers.filter(s =>
      s !== "home"
      && !s.startsWith("MeinServer_")
      && ns.hasRootAccess(s)
      && ns.getServerRequiredHackingLevel(s) <= hackLevel
      && !ns.getServer(s).backdoorInstalled
    );

    // Kürzeste Hack-Zeit zuerst → minimale Wartezeit
    candidates.sort((a, b) => ns.getHackTime(a) - ns.getHackTime(b));

    ns.clearLog();
    ns.print(`[Backdoor] ${candidates.length} Server offen. Starte...`);

    for (const target of candidates) {
      const path = findPath(target);
      if (!path) continue;

      try {
        for (const hop of path.slice(1)) ns.singularity.connect(hop);
        ns.print(`[Backdoor] Installiere auf: ${target} (${ns.tFormat(ns.getHackTime(target))})`);
        await ns.singularity.installBackdoor();
        ns.print(`[Backdoor] ✓ ${target}`);
      } catch (e) {
        ns.print(`[Backdoor] Fehler bei ${target}: ${e}`);
      } finally {
        try { ns.singularity.connect("home"); } catch (_) {}
      }
    }

    const done = allServers.filter(s =>
      s !== "home" && !s.startsWith("MeinServer_") && ns.getServer(s).backdoorInstalled
    ).length;
    ns.clearLog();
    ns.print(`[Backdoor] Fertig. Installiert: ${done} | Offen: ${candidates.length}`);
    ns.print(`[Backdoor] Nächster Durchlauf in ${LOOP_DELAY_MS / 1000}s`);

    await ns.sleep(LOOP_DELAY_MS);
  }
}
