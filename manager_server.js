/** @param {NS} ns */
// manager_server.js
// Standalone server admin manager — reads autoBuy/autoUpgrade settings from config.
// Calls cloud API directly (no sub-script) to avoid RAM starvation on small home servers.

const CONFIG_FILE = "main_manager_config.js";
const DEFAULT_LOOP_MS = 5000;
const SERVER_PREFIX = "MyServer_";

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

    if (guiState) {
      const purchased = ns.cloud.getServerNames();
      const money = ns.getPlayer().money;
      const limit = ns.cloud.getServerLimit();

      // Auto-Upgrade: step each server toward upgradeRam one power-of-2 at a time
      if (guiState.autoUpgrade && guiState.upgradeRam) {
        const targetRam = Number(guiState.upgradeRam);
        for (const s of purchased) {
          const currentRam = ns.getServerMaxRam(s);
          const nextRam = currentRam * 2;
          if (nextRam > targetRam) continue;
          const cost = ns.cloud.getServerUpgradeCost(s, nextRam);
          if (!Number.isFinite(cost) || cost <= 0) continue;
          if (money >= cost) {
            ns.cloud.upgradeServer(s, nextRam);
            ns.print(`[server] Upgraded ${s}: ${ns.format.ram(currentRam)} → ${ns.format.ram(nextRam)}`);
          }
        }
      }

      // Auto-Buy: fill server slots with 8 GB servers
      if (guiState.autoBuy && purchased.length < limit) {
        const cost = ns.cloud.getServerCost(8);
        if (cost > 0 && money >= cost) {
          const idx = purchased.length;
          const name = `${SERVER_PREFIX}${idx}`;
          const result = ns.cloud.purchaseServer(name, 8);
          if (result) {
            ns.print(`[server] Bought ${result} (8 GB) for ${ns.format.number(cost)}`);
          }
        }
      }
    }

    await ns.sleep(loopMs);
  }
}
