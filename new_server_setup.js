/** @param {NS} ns */
export async function main(ns) {
  // Lese Argument (Servername) aus
  const server = ns.args[0] || "MeinServer_0";
  const hackScript = ([
    "money-hack.js", 
    "share-ram.js", 
    "profit-check.js", 
    "manager_share-ram.js",
    "v_grow.js",
    "v_hack.js",
    "v_weaken.js" 
]);

  ns.tprint(`Setup läuft für: ${server}`);

  // Kopiere das Script von home auf den neuen Server
  const ok = await ns.scp(hackScript, server);
  if (!ok) {
    ns.tprint(`❌ scp fehlgeschlagen: ${hackScript} -> ${server}`);
    return;
  }

  // Berechne freien RAM auf Zielserver
  const freeRam = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
  const scriptCost = ns.getScriptRam(hackScript[0], server);
  const threads = Math.floor(freeRam / scriptCost);

  await ns.exec("profit-check.js", server)
  await ns.exec("manager_share-ram.js", server)
/*
  if (threads > 0) {
    ns.exec("profit-check.js", server)
    const pid = ns.exec(hackScript[0], server, threads, server); // du kannst server noch als arg an das hackScript übergeben
    if (pid > 0) ns.tprint(`🚀 ${hackScript[0]} auf ${server} gestartet (Threads: ${threads}, pid: ${pid})`);
    
    else ns.tprint(`⚠️ Exec fehlgeschlagen auf ${server} (Threads berechnet: ${threads})`);
  } 
  
  else {
    ns.tprint(`⚠️ Nicht genug freier RAM auf ${server} für ${hackScript[0]}`);
  }
  */
}