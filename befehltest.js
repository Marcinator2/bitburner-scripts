// STATUS: Experimentelles Scratch-Skript fuer manuelle Kauf-/Anzeige-Checks.
// Nicht in produktive Ablaufe einbinden, ausser die Logik wird vorher bewusst uebernommen.
/** @param {NS} ns */
export async function main(ns) {
  const ram = 2**16;
  const zielserverName = "the-hub";
  
  // 1. Kosten berechnen
  const kosten = ns.getPurchasedServerCost(ram);

  // 2. Formatieren
  // ns.formatRam macht aus 1048576 GB -> "1.00 PB" (Petabyte)
  const ramFormatiert = ns.formatRam(ram);
  
  // ns.formatNumber macht aus 1000000 -> "1.000m"
  const kostenFormatiert = "$" + ns.formatNumber(kosten);

  // 3. Ausgabe teshjls
  
  await ns.prompt(`Server-Kauf-Check:
Ein neuer Server kostet:
--------------------------
Speicher: ${ramFormatiert}
Kosten:   ${kostenFormatiert}
--------------------------

Ziel hat folgende Werte:
Ziel:     ${zielserverName}
Max Geld: $${ns.formatNumber(ns.getServerMaxMoney(zielserverName))}
Aktuell:  $${ns.formatNumber(ns.getServerMoneyAvailable(zielserverName))}`);

  ns.tprint(`Bericht für ${ramFormatiert} erstellt.`);
}