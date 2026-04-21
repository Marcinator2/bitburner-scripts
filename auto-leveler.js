/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("sleep");

  const programs = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe",
   "DeepscanV1.exe", "DeepscanV2.exe", "AutoLink.exe", "ServerProfiler.exe", "SQLInject.exe", "Formulas.exe"];
  const host = "home";
  const retryDelay = 30000; // wait 30s if not enough money
  const hourMs = 60 * 60 * 1000;

  ns.print("Starting hourly buyer...");

  while (true) {
    ns.clearLog();
    ns.print(`Starting cycle at ${new Date().toLocaleString()}`);

    try { ns.singularity.purchaseTor(); } catch (_) {}

    for (const program of programs) {
      if (ns.fileExists(program, host)) {
        ns.print(`${program} already present.`);
        continue;
      }

      ns.print(`${program} not yet purchasable. Waiting and retrying...`);
      while (!ns.fileExists(program, host)) {
        try {
          if (ns.singularity.purchaseProgram(program)) {
            ns.tprint(`Purchased: ${program}`);
            break;
          }
        } catch (_) {
          // Singularity API not available (no SF4) – skip
          ns.print(`${program}: Singularity API not available, skipping.`);
          break;
        }
        await ns.sleep(retryDelay);
      }
    }

    ns.print(`Cycle complete at ${new Date().toLocaleString()}. Waiting 1 hour until next cycle.`);
    await ns.sleep(hourMs);
  }
}