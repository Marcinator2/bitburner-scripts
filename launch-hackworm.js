/** @param {NS} ns */
export async function main(ns) {
  const SCRIPT  = "1st-hackworm.js";
  const WORKERS = ["v_hack.js", "v_grow.js", "v_weaken.js"];
  const HOST    = "hackworm-host";
  const RAM     = 16; // GB – enough for the manager + headroom

  // Reuse existing purchased server or buy a new one
  let host = ns.getPurchasedServers().find(s => s === HOST);

  if (!host) {
    host = ns.purchaseServer(HOST, RAM);
    if (!host) {
      ns.tprint(`❌ Kauf fehlgeschlagen – zu wenig Geld für ${RAM} GB Server.`);
      ns.tprint(`   Benötigte RAM: ${RAM} GB`);
      return;
    }
    ns.tprint(`✅ Server "${HOST}" (${RAM} GB) gekauft.`);
  } else {
    ns.tprint(`ℹ️  Nutze vorhandenen Server "${HOST}".`);
  }

  // Copy manager + workers to the host
  await ns.scp([SCRIPT, ...WORKERS], host);

  // Kill old instance if still running
  ns.scriptKill(SCRIPT, host);
  await ns.sleep(200);

  // Launch
  const pid = ns.exec(SCRIPT, host, 1);
  if (pid > 0) {
    ns.tprint(`✅ ${SCRIPT} läuft jetzt auf "${HOST}" – home-RAM vollständig für Worker frei.`);
  } else {
    const needed = ns.getScriptRam(SCRIPT, "home");
    ns.tprint(`❌ Start fehlgeschlagen. ${HOST} hat ${ns.getServerMaxRam(host)} GB, Skript benötigt ${needed} GB.`);
  }
}
