/** @param {NS} ns */

const CONFIG_FILE = "main_manager_config.js";

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

    let build = false;
    try {
      const raw = ns.read(CONFIG_FILE);
      if (raw) build = JSON.parse(raw)?.services?.programs?.build ?? false;
    } catch { /* use false */ }

    try { ns.singularity.purchaseTor(); } catch (_) {}

    for (const program of programs) {
      if (ns.fileExists(program, host)) {
        ns.print(`${program} already present.`);
        continue;
      }

      ns.print(`${program} not yet available. Trying to buy or create...`);
      while (!ns.fileExists(program, host)) {
        try {
          if (ns.singularity.purchaseProgram(program)) {
            ns.tprint(`Purchased: ${program}`);
            break;
          }

          if (build) {
            ns.print(`Not enough money for ${program}, trying to build it...`);
            if (ns.singularity.createProgram(program, false)) {
              ns.tprint(`Building: ${program} – waiting for completion...`);
              while (!ns.fileExists(program, host)) {
                const work = ns.singularity.getCurrentWork();
                if (!work || work.type !== "CREATE_PROGRAM" || work.programName !== program) {
                  ns.print(`Building of ${program} interrupted or finished.`);
                  break;
                }
                await ns.sleep(5000);
              }
              if (ns.fileExists(program, host)) {
                ns.tprint(`Built: ${program}`);
                break;
              }
            } else {
              ns.print(`Cannot build ${program} yet (hacking level too low?). Retrying in ${retryDelay / 1000}s...`);
            }
          } else {
            ns.print(`Not enough money for ${program}. Retrying in ${retryDelay / 1000}s...`);
          }
        } catch (_) {
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