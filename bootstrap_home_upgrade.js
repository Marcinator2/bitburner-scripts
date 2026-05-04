/** @param {NS} ns */
// bootstrap_home_upgrade.js — Upgrades home RAM via Singularity API when affordable.
// Only spends money when player has at least COST_MULTIPLIER × upgrade cost available.
// Self-terminates once main_manager.js is running.

const COST_MULTIPLIER = 2; // only upgrade if money >= cost * this factor
const LOOP_MS         = 15_000;

export async function main(ns) {
  ns.disableLog("ALL");

  const MAIN_MANAGER = "main_manager.js";
  const HOME         = "home";

  ns.print("[home-upgrade] Started. Upgrades home RAM when affordable.");

  while (true) {
    if (ns.scriptRunning(MAIN_MANAGER, HOME)) {
      ns.print("[home-upgrade] main_manager.js detected. Terminating.");
      return;
    }

    const cost  = ns.singularity.getUpgradeHomeRamCost();
    const money = ns.getPlayer().money;
    const curRam = ns.getServerMaxRam(HOME);

    if (money >= cost * COST_MULTIPLIER) {
      ns.singularity.upgradeHomeRam();
      ns.print(`[home-upgrade] Upgraded home RAM: ${ns.format.ram(curRam)} → ${ns.format.ram(ns.getServerMaxRam(HOME))} (cost: ${ns.format.number(cost)})`);
    } else {
      ns.print(`[home-upgrade] Home: ${ns.format.ram(curRam)} | Next upgrade: ${ns.format.number(cost)} (have ${ns.format.number(money)})`);
    }

    await ns.sleep(LOOP_MS);
  }
}
