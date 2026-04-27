/** @param {NS} ns */
// manager_server.js
// Standalone server admin manager — reads autoBuy/autoUpgrade settings from config.
// Replaces the handleServerAdmin() logic previously embedded in main_manager.js.

const CONFIG_FILE = "main_manager_config.js";
const BUY_SCRIPT  = "new_server_buy.js";
const DEFAULT_LOOP_MS = 5000;

export async function main(ns) {
  ns.disableLog("ALL");

  while (true) {
    let config = {};
    try {
      const raw = ns.read(CONFIG_FILE);
      if (raw) config = JSON.parse(raw);
    } catch { /* use empty config */ }

    const loopMs = Number(config?.loopMs) || DEFAULT_LOOP_MS;
    const guiState = config?.gui?.managerGui;

    if (guiState && ns.fileExists(BUY_SCRIPT, "home") && !ns.scriptRunning(BUY_SCRIPT, "home")) {
      const purchased = ns.getPurchasedServers();
      const money = ns.getPlayer().money;

      // Auto-Upgrade: step each server toward upgradeRam one power-of-2 at a time
      if (guiState.autoUpgrade && guiState.upgradeRam) {
        const targetRam = Number(guiState.upgradeRam);
        let minCost = Infinity;
        for (const s of purchased) {
          const nextRam = ns.getServerMaxRam(s) * 2;
          if (nextRam > targetRam) continue;
          const cost = ns.getPurchasedServerUpgradeCost(s, nextRam);
          if (Number.isFinite(cost) && cost > 0) minCost = Math.min(minCost, cost);
        }
        if (minCost < Infinity && money >= minCost) {
          ns.exec(BUY_SCRIPT, "home", 1, targetRam, true);
          await ns.sleep(loopMs);
          continue;
        }
      }

      // Auto-Buy: fill server slots with 8 GB servers
      if (guiState.autoBuy && purchased.length < ns.getPurchasedServerLimit()) {
        const cost = ns.getPurchasedServerCost(8);
        if (cost > 0 && money >= cost) {
          ns.exec(BUY_SCRIPT, "home", 1, 8);
        }
      }
    }

    await ns.sleep(loopMs);
  }
}
