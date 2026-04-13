// STATUS: Einfacher Legacy-Worker fuer ein einzelnes Target.
// Wird derzeit von keinem Manager gestartet; produktive Batch-Worker sind v_hack.js, v_grow.js und v_weaken.js.
/** @param {NS} ns */
export async function main(ns) {
  const target = String(ns.args[0] ?? "");

  if (!target) {
    ns.tprint("Nutzung: run hack-worker.js <target>");
    return;
  }

  if (!ns.hasRootAccess(target)) {
    ns.tprint(`Kein Root auf ${target}. Script beendet.`);
    return;
  }

  const moneyThreshold = ns.getServerMaxMoney(target) * 0.9;
  const minSec = ns.getServerMinSecurityLevel(target);
  const maxSec = minSec + 5;

  while (true) {
    const currentSec = ns.getServerSecurityLevel(target);
    const currentMoney = ns.getServerMoneyAvailable(target);

    if (currentSec > maxSec) await ns.weaken(target);
    else if (currentMoney < moneyThreshold) await ns.grow(target);
    else await ns.hack(target);
  }
}
