// STATUS: Experimental test script for upgrade/SCP ideas.
// The current content is not a production flow and serves only as a scratch/test pad.
/** @param {NS} ns */
export async function main(ns) {
  const ram = 2**14;
  const server = "MyServer_0";
  const files = ["money-hack.js", "profit-check.js", "share-ram.js"];

  const upgradeCost = ns.cloud.getServerUpgradeCost(server, ram);
  const player = ns.getPlayer();

  const upgradeServer = 0;


  ns.tprint(ram + "Byte Ram Server cost: " + ns.cloud.getServerCost(ram));
  //ns.tprint(ns.cloud.getServerCost(ram));//max 1048576  2**20
  //ns.scp(files, server);
 // ns.upgradePurchasedServer(server, ram);
  
  ns.tprint("Server: " + server + " upgrade cost: " + upgradeCost);
  if ((upgradeCost <= player.money) && (upgradeServer == 1)){
    ns.upgradePurchasedServer(server, ram);

  }

  ns.tprint(ns.formulas.hacknetNodes())

}