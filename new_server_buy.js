/** @param {NS} ns */
export async function main(ns) {
  const ram = sanitizeRam(ns.args[0], 2 ** 16);
  const prefix = "MeinServer_";
  const limit = ns.getPurchasedServerLimit();
  const purchased = ns.getPurchasedServers();

  ns.tprint("Maximale Serverzahl: " + limit);

  if (purchased.length >= limit) {
    ns.tprint("Kauf-Limit erreicht.");
    return;
  }

  // nächster Index = Anzahl gekaufter Server
  const idx = purchased.length;
  const name = `${prefix}${idx}`;

  if (ns.serverExists(name)) {
    ns.tprint(`Name ${name} existiert bereits — Abbruch.`);
    return;
  }

  const cost = ns.getPurchasedServerCost(ram);
  const money = (typeof ns.getPlayer === "function") ? ns.getPlayer().money : ns.getServerMoneyAvailable("home");

  ns.tprint(`Server-RAM: ${ns.formatRam(ram)} | Serverkosten: ${cost}`);
  
  if (money < cost) {
    ns.tprint(`Nicht genug Geld für ${name}: benötigt ${Math.floor(cost).toLocaleString()}, verfügbar ${Math.floor(money).toLocaleString()}`);
    return;
  }

  const purchasedName = ns.purchaseServer(name, ram);
  if (purchasedName) {
    ns.tprint(`✅ Gekauft: ${purchasedName}`);
    const pid = ns.exec("new_server_setup.js", "home", 1, purchasedName);
    ns.tprint(pid > 0 ? `Setup gestartet (pid ${pid})` : `Setup konnte nicht gestartet werden.`);
  } else {
    ns.tprint("❌ Kauf fehlgeschlagen.");
  }
}

function sanitizeRam(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 2 || numeric > 2 ** 20) {
    return fallback;
  }

  const floored = Math.floor(numeric);
  return Number.isInteger(Math.log2(floored)) ? floored : fallback;
}