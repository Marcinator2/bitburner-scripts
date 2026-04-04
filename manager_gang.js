/** @param {NS} ns */
export async function main(ns) {
  //ns.disableLog("ALL");

  const verbesserungsFaktor = 1.5; // Ascension-Multiplikator-Schwelle (hack-Mult muss sich verdreifachen)
  const minHackFuerCrime = 200;    // Hack-Stat-Schwelle: darunter → trainieren statt Crime
  const geldPuffer = 10_000_000;   // Mindestgeld auf dem Konto nach Equipment-Kauf
  const maxAmortisationStunden = 4; //1 Equipment wird nur gekauft wenn es sich in X Spielstunden amortisiert
  const loopDelayMs = 2000;         // Schleifenzeit in ms (muss mit ns.sleep übereinstimmen)

  // Equipment nach aufsteigendem Preis vorberechnen (günstigstes zuerst)
  const alleEquipments = ns.gang.getEquipmentNames()
    .map(e => ({ name: e, cost: ns.gang.getEquipmentCost(e), stats: ns.gang.getEquipmentStats(e) }))
    .filter(e => e.stats.hack > 1) // Nur Hack-relevante
    .sort((a, b) => a.cost - b.cost);

  function buyGangEquipment(memberStats) {
    const money = ns.getPlayer().money;

    for (const { name, stats: mStats } of memberStats) {
      const memberInfo = ns.gang.getMemberInformation(name);
      const istAmTrainieren = memberInfo.task === "Train Hacking";

      for (const equip of alleEquipments) {
        // Schon gekauft?
        if (memberInfo.upgrades.includes(equip.name) || memberInfo.augmentations.includes(equip.name)) continue;
        // Genug Geld?
        if (money <= equip.cost + geldPuffer) continue;

        // ROI-Prüfung:
        // Beim Training immer kaufen — Equipment beschleunigt Stat-Wachstum
        // Im Crime-Modus: Amortisationszeit berechnen
        let kaufen = false;
        if (istAmTrainieren || memberInfo.moneyGain <= 0) {
          kaufen = true; // Training-Equipment lohnt sich immer
        } else {
          // Zusätzlicher Gewinn pro Loop-Zyklus ≈ aktueller Gewinn × Hack-Multiplikator-Anteil
          const zusatzGewinnProZyklus = memberInfo.moneyGain * (equip.stats.hack - 1);
          if (zusatzGewinnProZyklus > 0) {
            const amortisationMs = (equip.cost / zusatzGewinnProZyklus) * loopDelayMs;
            const amortisationStunden = amortisationMs / (1000 * 60 * 60);
            kaufen = amortisationStunden <= maxAmortisationStunden;
            if (!kaufen) {
              ns.print(`SKIP: ${equip.name} für ${name} — Amortisation: ${amortisationStunden.toFixed(1)}h (Limit: ${maxAmortisationStunden}h)`);
            }
          }
        }

        if (kaufen && ns.gang.purchaseEquipment(name, equip.name)) {
          const istAmort = istAmTrainieren ? "Training" : "ROI ok";
          ns.print(`KAUF [${istAmort}]: ${name} → ${equip.name} (${ns.formatNumber(equip.cost)})`);
        }
      }
    }
  }

  while (true) {
    // Neue Mitglieder rekrutieren (while: manchmal sind mehrere auf einmal verfügbar)
    while (ns.gang.canRecruitMember()) {
      const newName = "GangMember_" + ns.gang.getMemberNames().length;
      ns.gang.recruitMember(newName);
    }

    const members = ns.gang.getMemberNames();
    const info = ns.gang.getGangInformation();

    // Member-Stats einmal pro Zyklus laden (nicht mehrfach pro Member)
    const memberStats = members.map(n => ({ name: n, stats: ns.gang.getMemberInformation(n) }));

    // Nur trainierte Members für Crime/Wanted-Logik heranziehen
    const trainedMembers = memberStats
      .filter(m => m.stats.hack >= minHackFuerCrime)
      .map(m => m.name);

    for (const { name, stats } of memberStats) {
      // Ascension wenn der Hack-Multiplikator sich mindestens verdreifacht
      const res = ns.gang.getAscensionResult(name);
      if (res && res.hack >= verbesserungsFaktor) {
        ns.gang.ascendMember(name);
        // Nach Ascension: Stats wurden zurückgesetzt → direkt zum Training
        ns.gang.setMemberTask(name, "Train Hacking");
        continue;
      }

      // PRIORITÄT 0: Zu schwach für Crime → trainieren
      // (gilt auch für gerade-ascendete Members, da ihr hack-Stat zurückgesetzt wurde)
      if (stats.hack < minHackFuerCrime) {
        ns.gang.setMemberTask(name, "Train Hacking");
        continue;
      }

      // PRIORITÄT 1: Wanted Level senken
      if (info.wantedLevel > 5000 || info.wantedLevelGain > 0) {
        const threshold = info.wantedLevel > 10000 ? 0.7 : 0.3;
        const idx = trainedMembers.indexOf(name);
        const cleanerCount = Math.ceil(trainedMembers.length * threshold);
        ns.gang.setMemberTask(name, idx < cleanerCount ? "Ethical Hacking" : "Money Laundering");
      }
      // PRIORITÄT 2: Respekt farmen
      else if (info.respect < 2_000_000) {
        ns.gang.setMemberTask(name, "Cyberterrorism");
      }
      // PRIORITÄT 3: Geld verdienen
      else {
        ns.gang.setMemberTask(name, "Money Laundering");
      }
    }

    buyGangEquipment(memberStats);
    await ns.sleep(loopDelayMs);
  }
}