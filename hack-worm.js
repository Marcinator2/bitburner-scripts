/** @param {NS} ns */
export async function main(ns) {
  const hackScript = ["money-hack.js", "share-ram.js"];
  const blacklist = ["home"];
  const killWaitMs = 250; // kurze Wartezeit nach Kill, damit RAM-Statistik aktualisiert

  // build server list (BFS-artig)
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

  for (let server of allServers) {
    // in der Server-Loop:
    if (blacklist.includes(server) || server.startsWith("MeinServer_")) {
      continue;
    }

    // versuche Root zu bekommen
    if (!ns.hasRootAccess(server)) {
      let portsOpened = 0;
      if (ns.fileExists("BruteSSH.exe", "home")) { ns.brutessh(server); portsOpened++; }
      if (ns.fileExists("FTPCrack.exe", "home")) { ns.ftpcrack(server); portsOpened++; }
      if (ns.fileExists("relaySMTP.exe", "home")) { ns.relaysmtp(server); portsOpened++; }
      if (ns.fileExists("HTTPWorm.exe", "home")) { ns.httpworm(server); portsOpened++; }
      if (ns.fileExists("SQLInject.exe", "home")) { ns.sqlinject(server); portsOpened++; }

      if (portsOpened >= ns.getServerNumPortsRequired(server)) {
        ns.nuke(server);
        ns.tprint("🔓 Root-Zugriff auf " + server + " erlangt!");
      }
    }

    if (!ns.hasRootAccess(server)) {
      ns.tprint("❌ Root-Zugriff auf " + server + " fehlgeschlagen.");
      continue;
    }

    // 1) Alle Instanzen von hackScript[0] auf dem Zielserver wirklich beenden
    let procs = ns.ps(server);
    let killed = 0;
    for (const p of procs) {
      if (p.filename === hackScript[0]) {
        // ns.kill(pid) beendet genau diesen Prozess (sicherer als ns.kill(filename, server) wenn mehrere instanzen existieren)
        ns.kill(p.pid);
        killed++;
        ns.tprint("🧨 Gekillt: " + hackScript[0] + " auf " + server + " (pid " + p.pid + ")");
      }
    }
    if (killed === 0) {
      ns.tprint("ℹ️ Keine laufenden Instanzen von " + hackScript[0] + " auf " + server);
    }

    // 2) kurz warten, damit RAM/Process-Listen aktualisiert werden
    await ns.sleep(killWaitMs);

    // 3) Datei-Existenz prüfen (auf home) und hochladen
    if (!ns.fileExists(hackScript[0], "home")) {
      ns.tprint("❌ " + hackScript[0] + " existiert nicht auf home. Überspringe " + server);
      continue;
    }
    if (!ns.fileExists(hackScript[1], "home")) {
      ns.tprint("❌ " + hackScript[1] + " existiert nicht auf home. Überspringe " + server);
      continue;
    }

    // scp lädt beide Dateien hoch
    await ns.scp(hackScript, server);

    // 4) freien RAM berechnen und hackScript starten, danach Rest mit share-ram füllen
    let freeRam = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);

    // RAM für das Hack-Script (money-hack.js)
    let hackRam = ns.getScriptRam(hackScript[0], server);
    if (hackRam <= 0) {
      ns.tprint("⚠️ Ungültige Script-RAM-Kosten für " + hackScript[0] + " auf " + server);
      continue;
    }

    // Berechne Threads für money-hack.js
    let hackThreads = Math.floor(freeRam / hackRam);

    // Wenn Threads > 0, starte money-hack
    let hackStarted = false;
    if (hackThreads > 0) {
      let pid = ns.exec(hackScript[0], server, hackThreads, server);
      if (pid > 0) {
        ns.tprint("🚀 " + hackScript[0] + " auf " + server + " gestartet (Threads: " + hackThreads + ", pid: " + pid + ").");
        hackStarted = true;
      } else {
        ns.tprint("⚠️ Exec fehlgeschlagen für " + hackScript[0] + " auf " + server + " (Threads berechnet: " + hackThreads + ").");
      }
    } else {
      ns.tprint("⚠️ Nicht genug freier RAM auf " + server + " für " + hackScript[0] + " (0 Threads).");
    }

    // Berechne verbleibenden RAM (theoretisch nach dem Start)
    // Wir rechnen mit der vorigen freeRam minus dem reservierten RAM für money-hack (auch wenn exec evtl. fehlgeschlagen ist).
    let reservedForHack = hackThreads * hackRam;
    let remainingRam = freeRam - reservedForHack;

    // Versuche verbleibenden RAM mit share-ram.js zu füllen
    let shareRam = ns.getScriptRam(hackScript[1], server);
    if (shareRam <= 0) {
      ns.tprint("⚠️ Ungültige Script-RAM-Kosten für " + hackScript[1] + " auf " + server);
      continue;
    }

    let shareThreads = Math.floor(remainingRam / shareRam);
    if (shareThreads > 0) {
      let pidShare = ns.exec(hackScript[1], server, shareThreads);
      if (pidShare > 0) {
        ns.tprint("🧩 " + hackScript[1] + " auf " + server + " gestartet (Threads: " + shareThreads + ", pid: " + pidShare + ").");
      } else {
        ns.tprint("⚠️ Exec fehlgeschlagen für " + hackScript[1] + " auf " + server + " (Threads berechnet: " + shareThreads + ").");
      }
    } else {
      ns.tprint("ℹ️ Kein verbleibender RAM für " + hackScript[1] + " auf " + server + " (benötigt " + shareRam + " RAM pro Thread).");
    }

    // Backdoor-Check (optional)
    let serverInfo = ns.getServer(server);
    if (!serverInfo.backdoorInstalled) {
      let playerLevel = ns.getHackingLevel();
      let requiredLevel = ns.getServerRequiredHackingLevel(server);
      if (playerLevel >= requiredLevel) {
        ns.tprint("✅ Backdoor auf " + server + " möglich! (Level " + playerLevel + "/" + requiredLevel + ")");
      } else {
        ns.tprint("❌ Backdoor auf " + server + " nicht möglich. (Level zu niedrig: " + playerLevel + "/" + requiredLevel + ")");
      }
    }
  }
}