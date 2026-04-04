/** @param {NS} ns */
export async function main(ns) {
  const scripts = ["money-hack.js", "profit-check.js", "manager_share-ram.js", "share-ram.js"];
  const blacklist = ["home"];
  const killWaitMs = 250; // kurze Wartezeit nach Kill, damit RAM-Statistik aktualisiert.1

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

    // 1) Alte money-hack/profit-check/share-ram Instanzen auf dem Zielserver beenden
    let procs = ns.ps(server);
    let killed = 0;
    for (const p of procs) {
      if (p.filename === scripts[0] || p.filename === scripts[1] || p.filename === scripts[2]|| p.filename === scripts[3]) {
        // ns.kill(pid) beendet genau diesen Prozess (sicherer als ns.kill(filename, server) wenn mehrere instanzen existieren)
        ns.kill(p.pid);
        killed++;
        ns.tprint("🧨 Gekillt: " + p.filename + " auf " + server + " (pid " + p.pid + ")");
      }
    }
    if (killed === 0) {
      ns.tprint("ℹ️ Keine laufenden Instanzen von " + scripts[0] + ", " + scripts[1] + ", " + scripts[2] + " oder " + scripts[3] + " auf " + server);
    }

    // 2) kurz warten, damit RAM/Process-Listen aktualisiert werden
    await ns.sleep(killWaitMs);

    // 3) Datei-Existenz prüfen (auf home) und hochladen
    if (!ns.fileExists(scripts[1], "home")) {
      ns.tprint("❌ " + scripts[1] + " existiert nicht auf home. Überspringe " + server);
      continue;
    }

    if (!ns.fileExists(scripts[0], "home")) {
      ns.tprint("❌ " + scripts[0] + " existiert nicht auf home. Überspringe " + server);
      continue;
    }
    if (!ns.fileExists(scripts[2], "home")) {
      ns.tprint("❌ " + scripts[2] + " existiert nicht auf home. Überspringe " + server);
      continue;
    }
        if (!ns.fileExists(scripts[3], "home")) {
      ns.tprint("❌ " + scripts[3] + " existiert nicht auf home. Überspringe " + server);
      continue;
    }

    // scp lädt money-hack + profit-check + share-ram hoch
    await ns.scp(scripts, server);

    // 4) Nach Server-Typ starten:
    //    - ohne Geld: profit-check einmal
    //    - mit Geld: money-hack mit maximalen Threads auf sich selbst
    let freeRam = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
    let maxMoney = ns.getServerMaxMoney(server);
    let reservedRam = 0;

    if (maxMoney <= 0) {
      let profitRam = ns.getScriptRam(scripts[1], server);
      if (profitRam <= 0) {
        ns.tprint("⚠️ Ungültige Script-RAM-Kosten für " + scripts[1] + " auf " + server);
        continue;
      }

      if (freeRam >= profitRam) {
        let pid = ns.exec(scripts[1], server, 1, server);
        if (pid > 0) {
          ns.tprint("🚀 " + scripts[1] + " auf " + server + " gestartet (Threads: 1, pid: " + pid + ").");
          reservedRam = profitRam;
        } else {
          ns.tprint("⚠️ Exec fehlgeschlagen für " + scripts[1] + " auf " + server + " (Threads: 1).");
        }
      } else {
        ns.tprint("⚠️ Nicht genug freier RAM auf " + server + " für " + scripts[1] + " (benötigt " + profitRam + " RAM).");
      }
    } else {
      let moneyRam = ns.getScriptRam(scripts[0], server);
      if (moneyRam <= 0) {
        ns.tprint("⚠️ Ungültige Script-RAM-Kosten für " + scripts[0] + " auf " + server);
        continue;
      }

      let moneyThreads = Math.floor(freeRam / moneyRam);
      if (moneyThreads > 0) {
        let pidMoney = ns.exec(scripts[0], server, moneyThreads, server);
        if (pidMoney > 0) {
          ns.tprint("💰 " + scripts[0] + " auf " + server + " gestartet (Threads: " + moneyThreads + ", pid: " + pidMoney + ").");
          reservedRam = moneyThreads * moneyRam;
        } else {
          ns.tprint("⚠️ Exec fehlgeschlagen für " + scripts[0] + " auf " + server + " (Threads berechnet: " + moneyThreads + ").");
        }
      } else {
        ns.tprint("⚠️ Nicht genug freier RAM auf " + server + " für " + scripts[0] + " (0 Threads).");
      }
    }

    // 5) Wenn nach dem Hauptskript noch RAM übrig ist, share-ram genau einmal starten
    let remainingRam = freeRam - reservedRam;
    let shareRam = ns.getScriptRam(scripts[2], server);
    if (shareRam <= 0) {
      ns.tprint("⚠️ Ungültige Script-RAM-Kosten für " + scripts[2] + " auf " + server);
      continue;
    }

    if (remainingRam >= shareRam) {
      let pidShare = ns.exec(scripts[2], server, 1);
      if (pidShare > 0) {
        ns.tprint("🧩 " + scripts[2] + " auf " + server + " gestartet (Threads: 1, pid: " + pidShare + ").");
      } else {
        ns.tprint("⚠️ Exec fehlgeschlagen für " + scripts[2] + " auf " + server + " (Threads: 1).");
      }
    } else {
      ns.tprint("ℹ️ Kein verbleibender RAM für " + scripts[2] + " auf " + server + " (benötigt " + shareRam + " RAM).");
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