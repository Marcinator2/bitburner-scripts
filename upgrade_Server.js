/** @param {NS} ns */
export async function main(ns) {
  const ram = 2 ** 12;//Max20

  const servers = ns.getPurchasedServers().filter(s => s.startsWith("MeinServer_"));
  if (servers.length === 0) {
    ns.tprint("Keine MeinServer_-Server gefunden.");
    return;
  }

  const gesamtKosten = servers.reduce((sum, s) => sum + ns.getPurchasedServerUpgradeCost(s, ram), 0);
  const spielerGeld  = ns.getPlayer().money;

  ns.tprint(`Gefundene Server: ${servers.join(", ")}`);
  ns.tprint(`Gesamtkosten: ${ns.formatNumber(gesamtKosten)}$  |  Dein Geld: ${ns.formatNumber(spielerGeld)}$`);

  const frage = `Alle ${servers.length} MeinServer_ auf ${ram} GB upgraden? Restgeld danach: ${ns.formatNumber(spielerGeld - gesamtKosten)}$`;
  const antwort = await ns.prompt(frage, { type: "boolean" });

  if (!antwort) {
    ns.tprint("Kauf abgebrochen.");
    return;
  }

  let erfolg = 0;
  for (const serverName of servers) {
    const kosten = ns.getPurchasedServerUpgradeCost(serverName, ram);
    if (kosten > ns.getPlayer().money) {
      ns.tprint(`[✗] ${serverName}: Nicht genug Geld (${ns.formatNumber(kosten)}$)`);
      continue;
    }
    ns.upgradePurchasedServer(serverName, ram);
    ns.tprint(`[✓] ${serverName} auf ${ram} GB upgradet.`);
    erfolg++;
  }

  ns.tprint(`Fertig: ${erfolg}/${servers.length} Server upgradet.`);
}