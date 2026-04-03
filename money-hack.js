/** @param {NS} ns */
export async function main(ns) {
  let target = ns.args[0];
  const pct_maxMoney = 0.9;

  // Sicherheitscheck: Falls kein Argument übergeben wurde
  if (!target) {
    ns.tprint("Fehler: Kein Ziel-Server angegeben!");
    return;
  }

  const target_skill_level = ns.getServerRequiredHackingLevel(target);
  if (target_skill_level > ns.getHackingLevel()) {
    ns.tprint("Skilllevel von Server zu hoch!");
    return;
  }

  // MaxMoney korrekt ermitteln und Script beenden, falls 0
  const targetMaxMoney = ns.getServerMaxMoney(target);
  const targetMaxRam = ns.getServerMaxRam(target);

  if (targetMaxMoney === 0 && targetMaxRam > 0) {
    ns.tprint(`Info: Ziel ${target} hat maxMoney = 0. Script wird beendet und RAM geteilt.`);
    ns.scriptKill("share-ram.js", ns.getHostname());
    await ns.scp("share-ram.js", target);
    ns.exec("share-ram.js", target, 1);
    return;
  }

  // Dynamische Grenzwerte
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