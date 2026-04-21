/** @param {NS} ns */
export async function main(ns) {
  // Read argument (server name)
  const server = ns.args[0] || "MyServer_0";
  const hackScript = ([
    "money-hack.js", 
    "share-ram.js", 
    "profit-check.js", 
    "manager_share-ram.js",
    "v_grow.js",
    "v_hack.js",
    "v_weaken.js" 
]);

  ns.tprint(`Setup running for: ${server}`);

  // Copy scripts from home to the new server
  const ok = await ns.scp(hackScript, server);
  if (!ok) {
    ns.tprint(`❌ scp failed: ${hackScript} -> ${server}`);
    return;
  }

  // Calculate free RAM on target server
  const freeRam = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
  const scriptCost = ns.getScriptRam(hackScript[0], server);
  const threads = Math.floor(freeRam / scriptCost);

  await ns.exec("profit-check.js", server)
  await ns.exec("manager_share-ram.js", server)
/*
  if (threads > 0) {
    ns.exec("profit-check.js", server)
    const pid = ns.exec(hackScript[0], server, threads, server); // you can also pass server as an arg to the hackScript
    if (pid > 0) ns.tprint(`🚀 ${hackScript[0]} started on ${server} (Threads: ${threads}, pid: ${pid})`);
    
    else ns.tprint(`⚠️ Exec failed on ${server} (threads calculated: ${threads})`);
  } 
  
  else {
    ns.tprint(`⚠️ Not enough free RAM on ${server} for ${hackScript[0]}`);
  }
  */
}