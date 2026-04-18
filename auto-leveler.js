/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("sleep");

  const programs = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe",
   "DeepscanV1.exe", "DeepscanV2.exe", "AutoLink.exe", "ServerProfiler.exe", "SQLInject.exe", "Formulas.exe"];
  const host = "home";
  const retryDelay = 30000; // 30s warten, wenn nicht genug Geld
  const hourMs = 60 * 60 * 1000;

  ns.print("Starte stündlichen Käufer...");

  while (true) {
    ns.clearLog();
    ns.print(`Starte Durchlauf um ${new Date().toLocaleString()}`);

    for (const program of programs) {
      if (ns.fileExists(program, host)) {
        ns.print(`${program} ist bereits vorhanden.`);
        continue;
      }

      if (ns.purchaseProgram(program)) {
        ns.tprint(`Gekauft: ${program}`);
        continue;
      }

      ns.print(`${program} noch nicht kaufbar. Warte und versuche es erneut...`);
      while (!ns.fileExists(program, host)) {
        if (ns.purchaseProgram(program)) {
          ns.tprint(`Gekauft: ${program}`);
          break;
        }
        await ns.sleep(retryDelay);
      }
    }

    ns.print(`Durchlauf fertig um ${new Date().toLocaleString()}. Warte 1 Stunde bis zum nächsten Durchlauf.`);
    await ns.sleep(hourMs);
  }
}