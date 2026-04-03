/** @param {NS} ns */
export async function main(ns) {
  const ram = 2 **16;// max 20
  //const ram = 1024 * 4;
  const prefix = "MeinServer_";
  // Kaufe genau 1 Server (du kannst das in eine Schleife packen)
  const limit = ns.getPurchasedServerLimit();
  const purchased = ns.getPurchasedServers();
  const server_kaufen = 1;

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

  ns.tprint("Serverkosten: "+ cost);
  
  if (money < cost) {
    ns.tprint(`Nicht genug Geld für ${name}: benötigt ${Math.floor(cost).toLocaleString()}, verfügbar ${Math.floor(money).toLocaleString()}`);
    return;
  }
  if (server_kaufen == 1){
    const purchasedName = ns.purchaseServer(name, ram);
    if (purchasedName) {
      ns.tprint(`✅ Gekauft: ${purchasedName}`);
      // Setup-Skript auf home starten und Name als Argument übergeben
      const pid = ns.exec("new_server_setup.js", "home", 1, purchasedName);
      ns.tprint(pid > 0 ? `Setup gestartet (pid ${pid})` : `Setup konnte nicht gestartet werden.`);
    } else {
      ns.tprint("❌ Kauf fehlgeschlagen.");
    }
  }
}