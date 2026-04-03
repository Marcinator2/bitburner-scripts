/** @param {NS} ns */
export async function main(ns) {
  const blacklist = ["home", "MeinServer_0"];
  const scriptName = "money-hack.js";
  
  // 1. Server sammeln und sortieren
  const serverData = collectServers(ns, blacklist);
  
  // 2. Verfügbaren RAM auf dem aktuellen Server berechnen
  const host = ns.getHostname();
  const maxRam = ns.getServerMaxRam(host);
  const usedRam = ns.getServerUsedRam(host);
  const scriptRam = ns.getScriptRam(scriptName);
  
  // Wir lassen ein bisschen Puffer (z.B. 10 GB oder 10%), damit das Hauptskript weiterlaufen kann
  const freeRam = maxRam - usedRam;
  
  if (freeRam < scriptRam) {
    ns.tprint("❌ Nicht genug RAM vorhanden, um Scripte zu starten!");
    return;
  }

  // 3. Berechnung der Threads pro Server
  const anzahlZiele = Math.min(20, serverData.length); // Wir nehmen z.B. die Top 20 Ziele
  const totalPossibleThreads = Math.floor(freeRam / scriptRam);
  const threadsPerServer = Math.floor(totalPossibleThreads / anzahlZiele);

  ns.tprint(`💻 RAM: ${ns.formatRam(freeRam)} frei | Threads pro Ziel: ${threadsPerServer}`);

  if (threadsPerServer < 1) {
    ns.tprint("⚠️ Warnung: Zu viele Ziele für den verfügbaren RAM. Reduziere 'anzahlZiele'!");
    return;
  }

  // 4. Scripte starten
  for (let i = 0; i < anzahlZiele; i++) {
    const s = serverData[i];
    
    if (ns.hasRootAccess(s.name)) {
      ns.tprint(`🚀 Starte Hack auf ${s.name} mit ${threadsPerServer} Threads`);
      ns.run(scriptName, threadsPerServer, s.name);
    } else {
      ns.tprint(`🔒 Kein Root-Zugriff auf ${s.name} - überspringe.`);
    }
  }
}

// Deine Hilfsfunktion (unverändert, nur logisch eingebunden)
function collectServers(ns, blacklist = []) {
  const visited = new Set(["home"]);
  const allServers = ["home"];
  for (let i = 0; i < allServers.length; i++) {
    for (const neighbor of ns.scan(allServers[i])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        allServers.push(neighbor);
      }
    }
  }
  let serverData = [];
  for (let server of allServers) {
    if (blacklist.includes(server)) continue;
    if (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(server)) {
      serverData.push({
        name: server,
        money: ns.getServerMaxMoney(server),
        hackLevel: ns.getServerRequiredHackingLevel(server)
      });
    }
  }
  serverData.sort((a, b) => b.money - a.money);
  return serverData;
}