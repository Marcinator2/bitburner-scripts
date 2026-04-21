/** @param {NS} ns */
export async function main(ns) {
  const ram = sanitizeRam(ns.args[0], 2 ** 16);
  const prefix = "MyServer_";
  const limit = ns.getPurchasedServerLimit();
  const purchased = ns.getPurchasedServers();

  ns.tprint("Maximum server count: " + limit);

  if (purchased.length >= limit) {
    ns.tprint("Purchase limit reached.");
    return;
  }

  // Next index = number of already purchased servers4
  const idx = purchased.length;
  const name = `${prefix}${idx}`;

  if (ns.serverExists(name)) {
    ns.tprint(`Name ${name} already exists — aborting.`);
    return;
  }

  const cost = ns.getPurchasedServerCost(ram);
  const money = (typeof ns.getPlayer === "function") ? ns.getPlayer().money : ns.getServerMoneyAvailable("home");

  ns.tprint(`Server RAM: ${ns.formatRam(ram)} | Server cost: ${cost}`);
  
  if (money < cost) {
    ns.tprint(`Not enough money for ${name}: requires ${Math.floor(cost).toLocaleString()}, available ${Math.floor(money).toLocaleString()}`);
    return;
  }

  const purchasedName = ns.purchaseServer(name, ram);
  if (purchasedName) {
    ns.tprint(`✅ Purchased: ${purchasedName}`);
    const pid = ns.exec("new_server_setup.js", "home", 1, purchasedName);
    ns.tprint(pid > 0 ? `Setup started (pid ${pid})` : `Setup could not be started.`);
  } else {
    ns.tprint("❌ Purchase failed.");
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