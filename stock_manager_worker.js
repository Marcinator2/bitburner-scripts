/** @param {NS} ns */
export async function main(ns) {
  const firma = "joesguns";
  //const symbol_Firma = "JGN";
  const host = "MeinServer_2";
  
  const v_hack = "v_hack.js";
  const v_grow = "v_grow.js";
  const v_weaken = "v_weaken.js";
  
  const pct_MinMoney = 0.2;
  const pct_MaxMoney = 0.8;
  const ramPuffer = 5;
  //const anzahl_Aktien = 2000000;
  
  while (true) {
    const curMoney = ns.getServerMoneyAvailable(firma);
    const maxMoney = ns.getServerMaxMoney(firma);
    const curSec = ns.getServerSecurityLevel(firma);
    const minSec = ns.getServerMinSecurityLevel(firma);

    // Threads IM Loop berechnen, damit wir immer aktuell sind
    let freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host) - ramPuffer;
    let threads = Math.floor(freeRam / ns.getScriptRam(v_weaken));

    if (threads <= 0) { await ns.sleep(1000); continue; }

    // PRIORITÄT 1: SECURITY
    if (curSec > minSec + 2) {
      ns.print("Security zu hoch...");
      ns.exec(v_weaken, host, threads, firma);
      await ns.sleep(ns.getWeakenTime(firma) + 100);
    } 
  
// PRIORITÄT 3: VORBEREITUNG FÜR NÄCHSTEN KAUF (Hacken ohne Short)
    else if (curMoney > maxMoney * pct_MaxMoney) {
      ns.print("Preis ist hoch. Hacke Server leer für den nächsten Zyklus...");
      
      while (ns.getServerMoneyAvailable(firma) > maxMoney * pct_MinMoney) {
        let loopThreads = Math.floor((ns.getServerMaxRam(host) - ns.getServerUsedRam(host) - ramPuffer) / 1.75);
        if (loopThreads <= 0) { await ns.sleep(1000); continue; }

        if (ns.getServerSecurityLevel(firma) > minSec + 2) {
          ns.exec(v_weaken, host, loopThreads, firma);
          await ns.sleep(ns.getWeakenTime(firma) + 100);
        } else {
          ns.exec(v_hack, host, loopThreads, firma);
          await ns.sleep(ns.getHackTime(firma) + 100);
        }
      }
      ns.tprint("--- BODEN ERREICHT: BEREIT FÜR NÄCHSTEN LONG-KAUF ---");
    }
    
    else {
      ns.exec(v_grow, host, threads, firma);
      await ns.sleep(ns.getGrowTime(firma) + 100);
    }
    await ns.sleep(200);
  }
}