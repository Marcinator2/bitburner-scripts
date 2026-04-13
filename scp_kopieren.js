// STATUS: Experimentelles Testskript fuer Upgrade-/SCP-Ideen.
// Der aktuelle Inhalt ist kein produktiver Ablauf und dient nur als Notiz-/Teststand.
/** @param {NS} ns */
export async function main(ns) {
  const ram = 2**14;
  const server = "MeinServer_0";
  const files = ["money-hack.js", "profit-check.js", "share-ram.js"];

  const upgradekosten = ns.getPurchasedServerUpgradeCost(server, ram);
  const spieler = ns.getPlayer();

  const server_upgraden= 0;


  ns.tprint(ram + "Byte Ram Server kosten: " + ns.getPurchasedServerCost(ram));
  //ns.tprint(ns.getPurchasedServerCost(ram));//max 1048576  2**20
  //ns.scp(files, server);
 // ns.upgradePurchasedServer(server, ram);
  
  ns.tprint("Server: " + server + "upgradekosten: " + upgradekosten);
  if ((upgradekosten <= spieler.money) && (server_upgraden == 1)){
    ns.upgradePurchasedServer(server, ram);

  }

  ns.tprint(ns.formulas.hacknetNodes())

}