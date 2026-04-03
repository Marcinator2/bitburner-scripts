/** @param {NS} ns */
export async function main(ns) {
  const serverName = "MeinServer_1";
  const ram = 2 ** 12; 
  const spielerGeld = ns.getPlayer().money
  const serverKosten = ns.getPurchasedServerUpgradeCost(serverName, ram);

  if (serverKosten > spielerGeld) {
    ns.tprint("Du hast nicht genug Geld! \n Kosten: " + serverKosten + " Dein Geld: " + spielerGeld);
    return; // Beendet das Skript vorzeitig
  }

  // ns.prompt öffnet ein Dialogfenster im Spiel
  // Wir nutzen await, damit das Skript auf deine Eingabe wartet
  const frage = `Willst du den Server upgraden? Restgeld danach: ${ns.formatNumber(spielerGeld - serverKosten)}$`;
  const antwort = await ns.prompt(frage, { type: "boolean" });

  if (antwort) {
    ns.upgradePurchasedServer(serverName, ram);
    ns.tprint("Server erfolgreich verbessert!");
  } else {
    ns.tprint("Kauf abgebrochen.");
  }
}