/** @param {NS} ns */
export async function main(ns) {
  // --- SCHRITT 1: START-DATEN SAMMELN ---
  const p1 = ns.getPlayer();
  const t1 = Date.now();
  const money1 = p1.money;
  const hackExp1 = p1.exp.hacking;

  // --- SCHRITT 2: WARTEN (z.B. 2 Sekunden für genauere Werte) ---
  const waitTimeMs = 10000; 
  ns.print(`Messe Zuwachsrate... bitte ${waitTimeMs/1000}s warten.`);
  await ns.sleep(waitTimeMs);

  // --- SCHRITT 3: END-DATEN SAMMELN ---
  const p2 = ns.getPlayer();
  const t2 = Date.now();
  
  // Zeitdifferenz in Sekunden berechnen
  const diffSeconds = (t2 - t1) / 1000;

  // --- SCHRITT 4: RATEN BERECHNEN ---
  // Formel: (Wert_Neu - Wert_Alt) / Zeit
  const moneyPerSec = (p2.money - money1) / diffSeconds;
  const expPerSec = (p2.exp.hacking - hackExp1) / diffSeconds;

  // --- SCHRITT 5: DAS FENSTER ANZEIGEN ---
  const botschaft = 
    `--- SPIELER-STATUSBERICHT ---` +
    ` \n💰 Geld: ${ns.formatNumber(p2.money)}` +
    ` \n📈 Einkommen: ${ns.formatNumber(moneyPerSec)} $/sec` +
    ` \n\n💻 Hacking Level: ${p2.skills.hacking}` +
    ` \n🧪 Hacking XP: ${ns.formatNumber(expPerSec)} xp/sec` +
    ` \n\n💀 Sündenregister:` +
    ` \n- Menschen getötet: ${p2.numPeopleKilled}` +
    ` \n- Karma: ${p2.karma.toFixed(2)}`;

  // ns.prompt öffnet ein Fenster. 
  // Das Skript wartet hier, bis du "OK" drückst!
  await ns.prompt(botschaft);
}