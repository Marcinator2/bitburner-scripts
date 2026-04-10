/** @param {NS} ns */
//1. Alle Server per BFS sammeln
//2. Filtern: maxMoney > 0, nicht in blacklist
//3. Sortieren nach maxMoney
//4. Ausgabe in Tabelle mit Root-Zugriff, Name, Max-Money, Required Level
export async function main(ns) {
  const blacklist = new Set(["home"]);

  // Alle Server per BFS sammeln
  const visited = new Set(["home"]);
  const queue = ["home"];
  while (queue.length) {
    for (const neighbor of ns.scan(queue.shift())) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  const HACK_FRACTION = 0.5;

  // Filtern, Profit-Rate berechnen und sortieren
  const servers = [...visited]
    .filter(s => !blacklist.has(s) && ns.getServerMaxMoney(s) > 0)
    .map(s => ({
      name: s,
      maxMoney: ns.getServerMaxMoney(s),
      reqLevel: ns.getServerRequiredHackingLevel(s),
      hasRoot: ns.hasRootAccess(s),
      rate: ns.getServerMaxMoney(s) * ns.hackAnalyze(s) * HACK_FRACTION / ns.getWeakenTime(s),
    }))
    .sort((a, b) => b.rate - a.rate);

  // Ausgabe sortiert nach Profit-Rate
  ns.tprint("╔════════════════════════════════════════════════════════════╗");
  ns.tprint("║  Server sortiert nach Profit-Rate ($/s)                    ║");
  ns.tprint("╠════════════════════════════════════════════════════════════╣");
  ns.tprint(`║  ${"#".padEnd(3)} ${"Server".padEnd(18)} ${"Max-Money".padStart(11)} ${"$/s".padStart(10)} ${"Req".padStart(4)}  ║`);
  ns.tprint("╠════════════════════════════════════════════════════════════╣");
  for (let i = 0; i < servers.length; i++) {
    const s = servers[i];
    const root = s.hasRoot ? " " : "🔒";
    const num  = String(i + 1).padEnd(3);
    const name = s.name.length > 18 ? s.name.slice(0, 18) : s.name.padEnd(18);
    const money = ns.nFormat(s.maxMoney, "$0.00a").padStart(11);
    const rate  = ns.nFormat(s.rate,     "$0.00a").padStart(10);
    const lvl   = String(s.reqLevel).padStart(4);
    ns.tprint(`║ ${root} ${num} ${name} ${money} ${rate} ${lvl}  ║`);
  }
  ns.tprint("╚════════════════════════════════════════════════════════════╝");
  ns.tprint(`  ${servers.length} Server gefunden.`);
}