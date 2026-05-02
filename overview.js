/** @param {NS} ns */
export async function main(ns) {
  // Collect all servers via BFS
  const visited = new Set(["home"]);
  const allServers = ["home"];
  for (let i = 0; i < allServers.length; i++) {
    for (const neighbor of ns.scan(allServers[i])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        allServers.push(neighbor);
      }
    }
  }

  // Sum income across all running scripts (PID-based, robust with many instances)
  let totalIncome = 0;
  let hackIncome = 0;
  let moneyHackCount = 0;
  
  // Build a server-based overview
  const serverInfo = {};
  for (const server of allServers) {
    const procs = ns.ps(server);
    const procMap = {};
    let usedRam = ns.getServerUsedRam(server);

    for (const proc of procs) {
      const running = ns.getRunningScript(proc.pid);
      if (!running) continue;

      const runtime = Math.max(1, running.onlineRunningTime);
      const incomePerSec = running.onlineMoneyMade / runtime;

      if (incomePerSec > 0) {
        totalIncome += incomePerSec;
        if (proc.filename === "money-hack.js") {
          hackIncome += incomePerSec;
          moneyHackCount++;
        }
      }

      const name = proc.filename.replace(".js", "");
      procMap[name] = (procMap[name] || 0) + proc.threads;
    }

    const maxRam = ns.getServerMaxRam(server);
    const currentMoney = ns.getServerMoneyAvailable(server);
    const maxMoney = ns.getServerMaxMoney(server);
    
    serverInfo[server] = {
      procs: procMap,
      usedRam,
      maxRam,
      currentMoney,
      maxMoney,
    };
  }

  // Output
  const message = [
    `═══════════════════════════════`,
    `Total income: $${ns.format.number(totalIncome)}/sec`,
    `Money-Hack (all servers): $${ns.format.number(hackIncome)}/sec`,
    `Money-Hack processes: ${moneyHackCount}`,
    `═══════════════════════════════`,
    ``,
    `Server overview (sorted by $/sec):`,
    ``,
  ];

  // Sort servers by income
  const serversByIncome = allServers.map(server => {
    let serverIncome = 0;
    for (const proc of ns.ps(server)) {
      const running = ns.getRunningScript(proc.pid);
      if (!running) continue;
      const runtime = Math.max(1, running.onlineRunningTime);
      serverIncome += running.onlineMoneyMade / runtime;
    }
    return { server, income: serverIncome };
  }).sort((a, b) => b.income - a.income);

  for (const { server } of serversByIncome) {
    const info = serverInfo[server];
    const procList = Object.entries(info.procs)
      .map(([name, threads]) => `${name}:${threads}`)
      .join(", ") || "none";
    
    const ramStr = `${ns.format.ram(info.usedRam)}/${ns.format.ram(info.maxRam)}`;
    const moneyStr = `$${ns.format.number(info.currentMoney)}/$${ns.format.number(info.maxMoney)}`;
    
    // Calculate server income for display
    let serverIncome = 0;
    for (const proc of ns.ps(server)) {
      const running = ns.getRunningScript(proc.pid);
      if (!running) continue;
      const runtime = Math.max(1, running.onlineRunningTime);
      serverIncome += running.onlineMoneyMade / runtime;
    }
    
    message.push(`${server.padEnd(15)} | $/s: ${ns.format.number(serverIncome).padEnd(12)} | RAM: ${ramStr.padEnd(15)} | Money: ${moneyStr.padEnd(20)} | Procs: ${procList}`);
  }

  await ns.prompt(message.join("\n"));

}