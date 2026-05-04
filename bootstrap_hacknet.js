/** @param {NS} ns */
// bootstrap_hacknet.js — Buys the first hacknet node when affordable.
// Launched by bootstrap.js during early game. Self-terminates once manager_hacknet.js
// is running (which takes over full hacknet management).

export async function main(ns) {
  ns.disableLog("ALL");

  const LOOP_MS         = 10_000;
  const HACKNET_MANAGER = "manager_hacknet.js";
  const HOME            = "home";

  ns.print("[hacknet-boot] Started. Will self-terminate when manager_hacknet.js runs.");

  while (true) {
    if (ns.scriptRunning(HACKNET_MANAGER, HOME)) {
      ns.print("[hacknet-boot] manager_hacknet.js detected. Terminating.");
      return;
    }

    if (ns.hacknet.numNodes() === 0) {
      const cost = ns.hacknet.getPurchaseNodeCost();
      if (ns.getPlayer().money >= cost) {
        ns.hacknet.purchaseNode();
        ns.print(`[hacknet-boot] Bought first hacknet node (cost: ${ns.format.number(cost)}).`);
      } else {
        ns.print(`[hacknet-boot] Waiting for ${ns.format.number(cost)} to buy first node.`);
      }
    } else {
      ns.print(`[hacknet-boot] ${ns.hacknet.numNodes()} node(s) active. Waiting for manager_hacknet.js.`);
    }

    await ns.sleep(LOOP_MS);
  }
}
