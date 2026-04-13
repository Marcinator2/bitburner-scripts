/** @param {NS} ns */
export async function main(ns) {
  const ram = sanitizeRam(ns.args[0], 2 ** 12);
  const skipPrompt = ns.args[1] === true || String(ns.args[1] || "").toLowerCase() === "true";

  const servers = ns.getPurchasedServers().filter(s => s.startsWith("MeinServer_"));
  if (servers.length === 0) {
    ns.tprint("Keine MeinServer_-Server gefunden.");
    return;
  }

  const plan = buildUpgradePlan(ns, servers, ram);
  if (plan.upgradable.length === 0) {
    if (plan.blockedDowngrades > 0) {
      ns.tprint(`Ziel-RAM ${ns.formatRam(ram)} ist kleiner als bei ${plan.blockedDowngrades} vorhandenen Servern. Downgrade wird nicht ausgefuehrt.`);
    }
    ns.tprint(`Keine MeinServer_ koennen auf ${ns.formatRam(ram)} upgegradet werden.`);
    return;
  }

  if (plan.blockedDowngrades > 0) {
    ns.tprint(`Hinweis: ${plan.blockedDowngrades} Server liegen bereits ueber ${ns.formatRam(ram)} und werden nicht verkleinert.`);
  }

  const gesamtKosten = plan.totalCost;
  const spielerGeld  = ns.getPlayer().money;

  ns.tprint(`Gefundene Server: ${servers.join(", ")}`);
  ns.tprint(`Gesamtkosten: ${ns.formatNumber(gesamtKosten)}$  |  Dein Geld: ${ns.formatNumber(spielerGeld)}$`);

  if (!skipPrompt) {
    const frage = `Alle ${plan.upgradable.length}/${servers.length} MeinServer_ auf ${ram} GB upgraden? Restgeld danach: ${ns.formatNumber(spielerGeld - gesamtKosten)}$`;
    const antwort = await ns.prompt(frage, { type: "boolean" });

    if (!antwort) {
      ns.tprint("Kauf abgebrochen.");
      return;
    }
  }

  let erfolg = 0;
  for (const entry of plan.upgradable) {
    const serverName = entry.serverName;
    const kosten = entry.cost;
    if (kosten > ns.getPlayer().money) {
      ns.tprint(`[✗] ${serverName}: Nicht genug Geld (${ns.formatNumber(kosten)}$)`);
      continue;
    }
    ns.upgradePurchasedServer(serverName, ram);
    ns.tprint(`[✓] ${serverName} auf ${ram} GB upgradet.`);
    erfolg++;
  }

  ns.tprint(`Fertig: ${erfolg}/${plan.upgradable.length} Server upgradet.`);
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