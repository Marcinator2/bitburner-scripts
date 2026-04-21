/** @param {NS} ns */
//1. Collect all servers via BFS
//2. Filter: maxMoney > 0, not in blacklist
//3. Sort by maxMoney
//4. Output in table with root access, name, max money, required level
export async function main(ns) {
  const blacklist = new Set(["home"]);

  // Collect all servers via BFS
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

  // Filter, calculate profit rate and sort
  const servers = [...visited]
    .filter(s => !blacklist.has(s) && ns.getServerMaxMoney(s) > 0)
    .map(s => ({
      name: s,
      maxMoney: ns.getServerMaxMoney(s),
      curMoney: ns.getServerMoneyAvailable(s),
      reqLevel: ns.getServerRequiredHackingLevel(s),
      hasRoot: ns.hasRootAccess(s),
      rate: ns.getServerMaxMoney(s) * ns.hackAnalyze(s) * HACK_FRACTION / ns.getWeakenTime(s),
    }))
    .sort((a, b) => b.rate - a.rate);

  // Output sorted by profit rate
  ns.tprint("╔══════════════════════════════════════════════════════════════════════╗");
  ns.tprint("║  Servers sorted by profit rate ($/s)                                 ║");
  ns.tprint("╠══════════════════════════════════════════════════════════════════════╣");
  ns.tprint(`║  ${"#".padEnd(3)} ${"Server".padEnd(18)} ${"Max-Money".padStart(11)} ${"Cur-Money".padStart(11)} ${"$/s".padStart(10)} ${"Req".padStart(4)}  ║`);
  ns.tprint("╠══════════════════════════════════════════════════════════════════════╣");
  for (let i = 0; i < servers.length; i++) {
    const s = servers[i];
    const root = s.hasRoot ? " " : "🔒";
    const num  = String(i + 1).padEnd(3);
    const name = s.name.length > 18 ? s.name.slice(0, 18) : s.name.padEnd(18);
    const money = ns.nFormat(s.maxMoney, "$0.00a").padStart(11);
    const cur   = ns.nFormat(s.curMoney, "$0.00a").padStart(11);
    const rate  = ns.nFormat(s.rate,     "$0.00a").padStart(10);
    const lvl   = String(s.reqLevel).padStart(4);
    ns.tprint(`║ ${root} ${num} ${name} ${money} ${cur} ${rate} ${lvl}  ║`);
  }
  ns.tprint("╚══════════════════════════════════════════════════════════════════════╝");
  ns.tprint(`  ${servers.length} servers found.`);
}