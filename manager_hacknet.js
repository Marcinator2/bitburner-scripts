/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("sleep");
  ns.clearLog();

  const DEFAULT_LOOP_DELAY_MS = 30;
  const reserveCash = 0; // keep a fixed amount in $
  const minAffordableMargin = 0; // minimum reserve in $, in addition to reserveCash
  let loopDelayMs = DEFAULT_LOOP_DELAY_MS;
  try {
    const cfgRaw = ns.read("main_manager_config.js");
    if (cfgRaw) loopDelayMs = Number(JSON.parse(cfgRaw)?.services?.hacknet?.loopMs) || DEFAULT_LOOP_DELAY_MS;
  } catch { /* use fallback */ }

  // Check if hacknet API is present (early exit)
  if (!ns.hacknet || typeof ns.hacknet.numNodes !== "function") {
    ns.tprint("Error: Hacknet API not available. Script terminated.");
    return;
  }

  while (true) {
    // Get available money (prefer ns.getPlayer())
    let playerMoney = 0;
    try {
      if (typeof ns.getPlayer === "function") {
        const p = ns.getPlayer();
        if (p && typeof p.money === "number") playerMoney = p.money;
      }
    } catch (e) {
      // ignore
    }
    if (!playerMoney || typeof playerMoney !== "number") {
      try {
        playerMoney = ns.getServerMoneyAvailable("home");
      } catch (e) {
        playerMoney = 0;
      }
    }
    const availableCash = Math.max(0, playerMoney - reserveCash - minAffordableMargin);

    // Read nodes
    const numNodes = ns.hacknet.numNodes();
    let nodes = [];
    for (let i = 0; i < numNodes; i++) {
      try {
        nodes.push(ns.hacknet.getNodeStats(i));
      } catch (e) {
        ns.tprint(`Error: hacknet.getNodeStats failed for node ${i}.`);
        return;
      }
    }

    // Average production per node (for new node estimation)
    const avgProd = nodes.length ? (nodes.reduce((s, n) => s + (n.production || 0), 0) / nodes.length) : 0.1;

    // Collect possible actions with estimated deltaProd and cost
    let actions = [];

    // Upgrade options for existing nodes
    for (let i = 0; i < numNodes; i++) {
      const s = nodes[i];
      const curProd = s.production ?? 0.000001;
      const level = s.level ?? 1;
      const ram = s.ram ?? 1;
      const cores = s.cores ?? 1;
      const cache = s.cache ?? 0;

      // Level +1
      if (typeof ns.hacknet.getLevelUpgradeCost === "function") {
        const cost = ns.hacknet.getLevelUpgradeCost(i, 1);
        if (isFinite(cost) && cost > 0) {
          const newLevel = level + 1;
          const estNewProd = curProd * (newLevel / Math.max(1, level));
          const delta = Math.max(0, estNewProd - curProd);
          actions.push({ type: "level", index: i, cost, delta, desc: `Node ${i} level+1` });
        }
      }

      // RAM upgrade +1
      if (typeof ns.hacknet.getRamUpgradeCost === "function") {
        const cost = ns.hacknet.getRamUpgradeCost(i, 1);
        if (isFinite(cost) && cost > 0) {
          const newRam = ram * 2;
          const estNewProd = curProd * (newRam / Math.max(1, ram));
          const delta = Math.max(0, estNewProd - curProd);
          actions.push({ type: "ram", index: i, cost, delta, desc: `Node ${i} ram*2 (estimated)` });
        }
      }

      // Cores +1
      if (typeof ns.hacknet.getCoreUpgradeCost === "function") {
        const cost = ns.hacknet.getCoreUpgradeCost(i, 1);
        if (isFinite(cost) && cost > 0) {
          const newCores = cores + 1;
          const estNewProd = curProd * (newCores / Math.max(1, cores));
          const delta = Math.max(0, estNewProd - curProd);
          actions.push({ type: "cores", index: i, cost, delta, desc: `Node ${i} cores+1` });
        }
      }

      // Cache +1 (conservative +10%)
      if (typeof ns.hacknet.getCacheUpgradeCost === "function") {
        const cost = ns.hacknet.getCacheUpgradeCost(i, 1);
        if (isFinite(cost) && cost > 0) {
          const estNewProd = curProd * 1.10;
          const delta = Math.max(0, estNewProd - curProd);
          actions.push({ type: "cache", index: i, cost, delta, desc: `Node ${i} cache+1 (estimated +10%)` });
        }
      }
    }

    // Purchase a new node
    if (typeof ns.hacknet.getPurchaseNodeCost === "function" && typeof ns.hacknet.purchaseNode === "function") {
      const cost = ns.hacknet.getPurchaseNodeCost();
      if (isFinite(cost) && cost > 0) {
        const estNewProd = Math.max(0.1, avgProd);
        const delta = estNewProd;
        actions.push({ type: "purchase", cost, delta, desc: `Buy new node (estimated prod ${estNewProd.toFixed(6)}/s)` });
      }
    }

    if (actions.length === 0) {
      return;
    }

    // Calculate ROI and sort (deltaProd / cost), higher ROI first
    actions = actions
      .map(a => ({ ...a, roi: a.cost > 0 ? (a.delta / a.cost) : 0 }))
      .sort((a, b) => b.roi - a.roi);

    const best = actions[0];

    if (best.cost > availableCash) {
      // Wait and retry later
      await ns.sleep(loopDelayMs);
      continue;
    }

    // Execute action (check whether the respective function exists)
    let success = false;
    try {
      switch (best.type) {
        case "purchase":
          if (typeof ns.hacknet.purchaseNode === "function") {
            success = ns.hacknet.purchaseNode();
            ns.tprint(success ? `✅ New node purchased.` : `❌ Purchase failed.`);
          } else ns.tprint("❌ purchaseNode not available.");
          break;
        case "level":
          if (typeof ns.hacknet.upgradeLevel === "function") {
            success = ns.hacknet.upgradeLevel(best.index, 1);
            ns.tprint(success ? `✅ Node ${best.index} level+1` : `❌ Level upgrade failed (node ${best.index}).`);
          } else ns.tprint("❌ upgradeLevel not available.");
          break;
        case "ram":
          if (typeof ns.hacknet.upgradeRam === "function") {
            success = ns.hacknet.upgradeRam(best.index, 1);
            ns.tprint(success ? `✅ Node ${best.index} RAM upgrade` : `❌ RAM upgrade failed (node ${best.index}).`);
          } else ns.tprint("❌ upgradeRam not available.");
          break;
        case "cores":
          if (typeof ns.hacknet.upgradeCore === "function") {
            success = ns.hacknet.upgradeCore(best.index, 1);
            ns.tprint(success ? `✅ Node ${best.index} cores+1` : `❌ Core upgrade failed (node ${best.index}).`);
          } else ns.tprint("❌ upgradeCore not available.");
          break;
        case "cache":
          if (typeof ns.hacknet.upgradeCache === "function") {
            success = ns.hacknet.upgradeCache(best.index, 1);
            ns.tprint(success ? `✅ Node ${best.index} cache+1` : `❌ Cache upgrade failed (node ${best.index}).`);
          } else ns.tprint("❌ upgradeCache not available.");
          break;
        default:
          ns.tprint("❌ Unknown action: " + best.type);
      }
    } catch (e) {
      ns.tprint("❌ Error executing action: " + String(e));
      success = false;
    }

    if (success) ns.tprint("ℹ️ Action executed successfully.");

    // Wait before the next pass
    await ns.sleep(loopDelayMs);
  }
}