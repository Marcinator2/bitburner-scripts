/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("sleep");
  ns.disableLog("exec");
  ns.disableLog("scp");
  ns.disableLog("getServerUsedRam");
  ns.disableLog("getServerMaxRam");

  const homeHost = "home";
  const worker = "share-ram.js";
  const DEFAULT_QUOTA = 0.1;
  const DEFAULT_LOOP_MS = 30_000;

  let shareQuota = DEFAULT_QUOTA;
  let loopMs = DEFAULT_LOOP_MS;
  try {
    const raw = ns.read("main_manager_config.js");
    if (raw) {
      const cfg = JSON.parse(raw);
      shareQuota = Number(cfg?.services?.shareRam?.shareQuota) || DEFAULT_QUOTA;
      loopMs = Number(cfg?.services?.shareRam?.loopMs) || DEFAULT_LOOP_MS;
    }
  } catch { /* use defaults */ }

  function spawnOnHost(h) {
    if (ns.scriptRunning(worker, h)) return;
    // Copy worker script to cloud servers if missing
    if (h !== homeHost && !ns.fileExists(worker, h)) {
      ns.scp(worker, h, homeHost);
    }
    const workerRam = ns.getScriptRam(worker, h);
    if (workerRam <= 0) return;
    const reserved = ns.getServerMaxRam(h) * shareQuota;
    const free = ns.getServerMaxRam(h) - ns.getServerUsedRam(h);
    const threads = Math.floor(Math.min(free, reserved) / workerRam);
    if (threads > 0) {
      ns.exec(worker, h, threads);
    }
  }

  while (true) {
    const hosts = [homeHost, ...ns.cloud.getServerNames()];
    for (const h of hosts) {
      spawnOnHost(h);
    }
    await ns.sleep(loopMs);
  }
}
