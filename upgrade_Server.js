/** @param {NS} ns */
export async function main(ns) {
  const ram = sanitizeRam(ns.args[0], 2 ** 12);
  const skipPrompt = ns.args[1] === true || String(ns.args[1] || "").toLowerCase() === "true";

  const servers = ns.getPurchasedServers().filter(s => s.startsWith("MyServer_"));
  if (servers.length === 0) {
    ns.tprint("No MyServer_ servers found.");
    return;
  }

  const plan = buildUpgradePlan(ns, servers, ram);
  if (plan.upgradable.length === 0) {
    if (plan.blockedDowngrades > 0) {
      ns.tprint(`Target RAM ${ns.formatRam(ram)} is smaller than ${plan.blockedDowngrades} existing servers. Downgrade will not be performed.`);
    }
    ns.tprint(`No MyServer_ servers can be upgraded to ${ns.formatRam(ram)}.`);
    return;
  }

  if (plan.blockedDowngrades > 0) {
    ns.tprint(`Note: ${plan.blockedDowngrades} servers already exceed ${ns.formatRam(ram)} and will not be downgraded.`);
  }

  const totalCost = plan.totalCost;
  const playerMoney  = ns.getPlayer().money;

  ns.tprint(`Found servers: ${servers.join(", ")}`);
  ns.tprint(`Total cost: ${ns.formatNumber(totalCost)}$  |  Your money: ${ns.formatNumber(playerMoney)}$`);

  if (!skipPrompt) {
    const question = `Upgrade all ${plan.upgradable.length}/${servers.length} MyServer_ to ${ram} GB? Remaining money after: ${ns.formatNumber(playerMoney - totalCost)}$`;
    const answer = await ns.prompt(question, { type: "boolean" });

    if (!answer) {
      ns.tprint("Upgrade cancelled.");
      return;
    }
  }

  let success = 0;
  for (const entry of plan.upgradable) {
    const serverName = entry.serverName;
    const cost = entry.cost;
    if (cost > ns.getPlayer().money) {
      ns.tprint(`[✗] ${serverName}: Not enough money (${ns.formatNumber(cost)}$)`);
      continue;
    }
    ns.upgradePurchasedServer(serverName, ram);
    ns.tprint(`[✓] ${serverName} upgraded to ${ram} GB.`);
    success++;
  }

  ns.tprint(`Done: ${success}/${plan.upgradable.length} servers upgraded.`);
}

function buildUpgradePlan(ns, servers, ram) {
  const upgradable = [];
  let totalCost = 0;
  let blockedDowngrades = 0;

  for (const serverName of servers) {
    const currentRam = ns.getServerMaxRam(serverName);
    if (currentRam >= ram) {
      if (currentRam > ram) {
        blockedDowngrades++;
      }
      continue;
    }

    const cost = ns.getPurchasedServerUpgradeCost(serverName, ram);
    if (!Number.isFinite(cost) || cost <= 0) {
      continue;
    }

    upgradable.push({ serverName, cost });
    totalCost += cost;
  }

  return { upgradable, totalCost, blockedDowngrades };
}

function sanitizeRam(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 2 || numeric > 2 ** 20) {
    return fallback;
  }

  const floored = Math.floor(numeric);
  return Number.isInteger(Math.log2(floored)) ? floored : fallback;
}