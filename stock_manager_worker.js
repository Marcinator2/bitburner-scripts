/** @param {NS} ns */
export async function main(ns) {
  const company = "joesguns";
  //const firmSymbol = "JGN";
  const host = "MyServer_2";
  
  const v_hack = "v_hack.js";
  const v_grow = "v_grow.js";
  const v_weaken = "v_weaken.js";
  
  const pct_MinMoney = 0.2;
  const pct_MaxMoney = 0.8;
  const ramBuffer = 5;
  //const shareCount = 2000000;
  
  while (true) {
    const curMoney = ns.getServerMoneyAvailable(company);
    const maxMoney = ns.getServerMaxMoney(company);
    const curSec = ns.getServerSecurityLevel(company);
    const minSec = ns.getServerMinSecurityLevel(company);

    // Calculate threads inside the loop to always have up-to-date values
    let freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host) - ramBuffer;
    let threads = Math.floor(freeRam / ns.getScriptRam(v_weaken));

    if (threads <= 0) { await ns.sleep(1000); continue; }

    // PRIORITY 1: SECURITY
    if (curSec > minSec + 2) {
      ns.print("Security too high...");
      ns.exec(v_weaken, host, threads, company);
      await ns.sleep(ns.getWeakenTime(company) + 100);
    } 
  
// PRIORITY 3: PREP FOR NEXT BUY (hack without short)
    else if (curMoney > maxMoney * pct_MaxMoney) {
      ns.print("Price is high. Hacking server to empty for the next cycle...");
      
      while (ns.getServerMoneyAvailable(company) > maxMoney * pct_MinMoney) {
        let loopThreads = Math.floor((ns.getServerMaxRam(host) - ns.getServerUsedRam(host) - ramBuffer) / 1.75);
        if (loopThreads <= 0) { await ns.sleep(1000); continue; }

        if (ns.getServerSecurityLevel(company) > minSec + 2) {
          ns.exec(v_weaken, host, loopThreads, company);
          await ns.sleep(ns.getWeakenTime(company) + 100);
        } else {
          ns.exec(v_hack, host, loopThreads, company);
          await ns.sleep(ns.getHackTime(company) + 100);
        }
      }
      ns.tprint("--- BOTTOM REACHED: READY FOR NEXT LONG BUY ---");
    }
    
    else {
      ns.exec(v_grow, host, threads, company);
      await ns.sleep(ns.getGrowTime(company) + 100);
    }
    await ns.sleep(200);
  }
}