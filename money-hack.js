/** @param {NS} ns */
export async function main(ns) {
  let target = ns.args[0];
  const pct_maxMoney = 0.9;

  // Safety check: no argument was passed
  if (!target) {
    ns.tprint("Error: No target server specified!");
    return;
  }

  const target_skill_level = ns.getServerRequiredHackingLevel(target);
  if (target_skill_level > ns.getHackingLevel()) {
    ns.tprint("Server skill level too high!");
    return;
  }

  // Ensure root access — nuke if needed (works for servers with 0 required ports)
  if (!ns.hasRootAccess(target)) {
    try {
      if (ns.fileExists("BruteSSH.exe", "home"))  ns.brutessh(target);
      if (ns.fileExists("FTPCrack.exe", "home"))  ns.ftpcrack(target);
      if (ns.fileExists("relaySMTP.exe", "home")) ns.relaysmtp(target);
      if (ns.fileExists("HTTPWorm.exe", "home"))  ns.httpworm(target);
      if (ns.fileExists("SQLInject.exe", "home")) ns.sqlinject(target);
      ns.nuke(target);
    } catch (e) {
      ns.tprint(`ERROR: Cannot get root access on ${target}: ${e}`);
      return;
    }
  }

  // Determine maxMoney correctly and stop script if 0
  const targetMaxMoney = ns.getServerMaxMoney(target);
  const targetMaxRam = ns.getServerMaxRam(target);

  if (targetMaxMoney === 0 && targetMaxRam > 0) {
    ns.tprint(`Info: Target ${target} has maxMoney = 0. Script ending and sharing RAM.`);
    ns.scriptKill("share-ram.js", ns.getHostname());
    await ns.scp("share-ram.js", target);
    ns.exec("share-ram.js", target, 1);
    return;
  }

  // Dynamic thresholds
  const moneyThreshold = targetMaxMoney * pct_maxMoney;
  const minSec = ns.getServerMinSecurityLevel(target);
  const maxSec = minSec + 5;

  while (true) {
    const currentSec = ns.getServerSecurityLevel(target);
    const currentMoney = ns.getServerMoneyAvailable(target);

    if (currentSec > maxSec) {
      await ns.weaken(target);
    } else if (currentMoney < moneyThreshold) {
      await ns.grow(target);
    } else {
      await ns.hack(target);
    }
  }
}