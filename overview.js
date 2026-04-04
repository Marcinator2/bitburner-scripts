/** @param {NS} ns */
export async function main(ns) {
  // Alle Server per BFS sammeln
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

  // Einkommen über alle laufenden Skripte summieren (PID-basiert, robust bei vielen Instanzen)
  let totalIncome = 0;
  let hackIncome = 0;
  let moneyHackCount = 0;
  
  // Serverbasierten Überblick bauen
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

  // Ausgabe
  const message = [
    `═══════════════════════════════`,
    `Gesamt-Einkommen: $${ns.formatNumber(totalIncome)}/sec`,
    `Money-Hack (alle Server): $${ns.formatNumber(hackIncome)}/sec`,
    `Money-Hack Prozesse: ${moneyHackCount}`,
    `═══════════════════════════════`,
    ``,
    `Server-Übersicht (nach $/sec sortiert):`,
    ``,
  ];

  // Server nach Einkommen sortieren
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
    
    const ramStr = `${ns.formatRam(info.usedRam)}/${ns.formatRam(info.maxRam)}`;
    const moneyStr = `$${ns.formatNumber(info.currentMoney)}/$${ns.formatNumber(info.maxMoney)}`;
    
    // Berechne Server-Einkommen für Anzeige
    let serverIncome = 0;
    for (const proc of ns.ps(server)) {
      const running = ns.getRunningScript(proc.pid);
      if (!running) continue;
      const runtime = Math.max(1, running.onlineRunningTime);
      serverIncome += running.onlineMoneyMade / runtime;
    }
    
    message.push(`${server.padEnd(15)} | $/s: ${ns.formatNumber(serverIncome).padEnd(12)} | RAM: ${ramStr.padEnd(15)} | Money: ${moneyStr.padEnd(20)} | Procs: ${procList}`);
  }

  await ns.prompt(message.join("\n"));

}