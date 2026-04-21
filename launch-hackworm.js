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
      ns.tprint(`❌ Purchase failed – not enough money for a ${RAM} GB server.`);
      ns.tprint(`   Required RAM: ${RAM} GB`);
      return;
    }
    ns.tprint(`✅ Server "${HOST}" (${RAM} GB) purchased.`);
  } else {
    ns.tprint(`ℹ️  Using existing server "${HOST}".`);
  }

  // Copy manager + workers to the host
  await ns.scp([SCRIPT, ...WORKERS], host);

  // Kill old instance if still running
  ns.scriptKill(SCRIPT, host);
  await ns.sleep(200);

  // Launch
  const pid = ns.exec(SCRIPT, host, 1);
  if (pid > 0) {
    ns.tprint(`✅ ${SCRIPT} is now running on "${HOST}" – home RAM fully free for workers.`);
  } else {
    const needed = ns.getScriptRam(SCRIPT, "home");
    ns.tprint(`❌ Start failed. ${HOST} has ${ns.getServerMaxRam(host)} GB, script requires ${needed} GB.`);
  }
}
