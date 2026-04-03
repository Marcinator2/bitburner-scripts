/** @param {NS} ns */
export async function main(ns) {
// Schaltet die nervigen Standard-Logs für Geldabfragen und Task-Zuweisungen aus
  ns.disableLog("getServerMoneyAvailable");
 // ns.disableLog("gang.setMemberTask"); 
 // ns.disableLog("sleep");
//ns.disableLog("ALL"); // Macht das Log übersichtlicher
const auto_levelup = true;
const verbesserungsFakor = 3.4;

function buyGangEquipment(ns) {
  if (auto_levelup){

    const members = ns.gang.getMemberNames();
    // Holt sich ALLES: Waffen, Rüstung, Fahrzeuge UND Rootkits
    const allEquipment = ns.gang.getEquipmentNames();

    for (const name of members) {
      const memberInfo = ns.gang.getMemberInformation(name);

      for (const equipName of allEquipment) {
        // 1. Prüfen: Hat das Mitglied dieses Teil schon?
        if (memberInfo.upgrades.includes(equipName) || memberInfo.augmentations.includes(equipName)) {
          continue; // Wenn ja, überspringen wir es
        }

        // 2. Prüfen: Ist es ein Rootkit oder Hacking-Augmentation?
        // Wir schauen nach, ob das Teil den Hacking-Skill verbessert
        const stats = ns.gang.getEquipmentStats(equipName);
        if (stats.hack > 1) { 
          
          const cost = ns.gang.getEquipmentCost(equipName);
          
          // 3. Sicherheits-Check: Haben wir genug Geld? 
          // (Hier: Kauf nur, wenn wir danach noch 10 Mio. auf dem Konto haben)
          if (ns.getServerMoneyAvailable("home") > cost + 10000000) {
            if (ns.gang.purchaseEquipment(name, equipName)) {
              ns.print(`ERFOLG: ${name} hat jetzt ${equipName} erhalten.`);
            }
          }
        }
      }
    }
  }
}

  while (true) {
    if (ns.gang.canRecruitMember()) {
      let newName = "GangMember_" + ns.gang.getMemberNames().length;
      ns.gang.recruitMember(newName);
    }

    const members = ns.gang.getMemberNames();
    const info = ns.gang.getGangInformation();

    for (const name of members) {
      // 2. Ascension (Bleibt gleich)
      const res = ns.gang.getAscensionResult(name);
      if (res && res.hack > verbesserungsFakor) { 
        ns.gang.ascendMember(name);
      }

      // --- NEUE ZUSAMMENGEFASSTE LOGIK ---
      
      // PRIORITÄT 1: Wanted Level senken (Das Feuer löschen)
      // Wir prüfen hier das Level UND ob es gerade steigt
      if (info.wantedLevel > 5000 || info.wantedLevelGain > 0) {
          // Bei sehr hohem Level (über 1000) schicken wir 70% zum Putzen
          // Bei niedrigem, aber steigendem Level nur 30%
          const threshold = info.wantedLevel > 10000 ? 0.7 : 0.3;
          
          if (Math.random() < threshold) { 
              ns.gang.setMemberTask(name, "Ethical Hacking");
          } else {
              ns.gang.setMemberTask(name, "Money Laundering");
              //ns.gang.setMemberTask(name, "Ethical Hacking");
          }
      } 
      // PRIORITÄT 2: Respekt farmen (wenn Wanted okay ist)
      else if (info.respect < 2000000) { 
          ns.gang.setMemberTask(name, "Cyberterrorism");
      } 
      // PRIORITÄT 3: Geld verdienen
      else {
          ns.gang.setMemberTask(name, "Money Laundering");
          //ns.gang.setMemberTask(name, "Cyberterrorism");
      }
    }

    // HIER der Aufruf der neuen Funktion
    buyGangEquipment(ns);
    await ns.sleep(2000);
  }
}