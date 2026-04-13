/** @param {NS} ns */
export async function main(ns) {
  //ns.disableLog("ALL");

  const verbesserungsFaktor = 1.8; // Ascension-Multiplikator-Schwelle (hack-Mult muss sich verdreifachen)
  const combatAscendFaktor = 1.35; // Combat-Ascension-Schwelle für War-Team
  const minHackFuerCrime = 200;    // Hack-Stat-Schwelle: darunter → trainieren statt Crime
  const minHackShare = 0.5;       // Mindestens 50% der Gang bleiben auf Hacking-Tasks
  const prepCombatMode = false;    // true = nur Vorbereitung (Combat trainieren), false = normaler Gang-Betrieb
  const powerFarmMode = false;      // true = Power über Territory Warfare farmen, aber ohne Clashes
  const powerFarmShare = 0.8;     // Anteil der Gang für Power-Farming, zusätzlich begrenzt durch minHackShare
  const prepDexFocus = false;       // true = Swap anhand DEX-Fortschritt, false = anhand Combat-Summe
  const dexFloorRatio = 0.6;       // Bei DEX-Fokus: dex muss mind. X% vom höchsten anderen Combat-Stat sein
  const swapMinAbs = 120;          // Absoluter Mindestfortschritt für Swap
  const swapPct = 0.2;             // Relativer Fortschritt für Swap (0.2=20% vom Startwert)
  const territoryPrepTarget = 0.98; // Bis zu diesem Wert aktiv auf Territory vorbereiten
  const startWarChance = 0.60;     // Territory Warfare einschalten ab dieser Ø-Chance
  const stopWarChance = 0.52;      // Territory Warfare ausschalten unter dieser Ø-Chance
  const geldPuffer = 10_000_000;   // Mindestgeld auf dem Konto nach Equipment-Kauf
  const maxAmortisationStunden = 4; //1 Equipment wird nur gekauft wenn es sich in X Spielstunden amortisiert
  const loopDelayMs = 2000;         // Schleifenzeit in ms (muss mit ns.sleep übereinstimmen)
  const prepStatusEveryLoops = 5;   // Status-Ausgabe nur jede X Schleifen
  const minRespectForCyberterrorismMin = 10_500_000; // Untergrenze für dynamische Cyberterrorism-Schwelle
  const minRespectForCyberterrorismMax = 25_000_000; // Obergrenze für dynamische Cyberterrorism-Schwelle
  const respectRaiseFactor = 1.2;   // Schwelle steigt bei stabiler Wanted-Lage
  const respectLowerFactor = 0.9;   // Schwelle sinkt bei instabiler Wanted-Lage
  const respectAdjustEveryLoops = 30; // Anpassung alle X Schleifen (bei 2s Loop = 60s)

  const allServers = ns.scan("home").filter(s => s !== "home");
  const visited = new Set(["home"]);
  const prepBaseCombat = new Map(); // name -> Combat-Startwert
  const prepBaseDex = new Map(); // name -> DEX-Startwert
  const prepDoneMembers = new Set(); // Members, die +100 erreicht haben
  const activePrepCombatMembers = new Set(); // Aktuelle Combat-Trainingsgruppe (stabil bis +100 erreicht)
  let prepRound = 1;
  let loopCount = 0;
  let minRespectForCyberterrorism = 2_000_000;

  // Equipment-Listen nach Preis vorberechnen
  const hackEquipments = ns.gang.getEquipmentNames()
    .map(e => ({ name: e, cost: ns.gang.getEquipmentCost(e), stats: ns.gang.getEquipmentStats(e) }))
    .filter(e => e.stats.hack > 1) // Nur Hack-relevante
    .sort((a, b) => a.cost - b.cost);

  const combatEquipments = ns.gang.getEquipmentNames()
    .map(e => ({ name: e, cost: ns.gang.getEquipmentCost(e), stats: ns.gang.getEquipmentStats(e) }))
    .filter(e => (e.stats.str > 1 || e.stats.def > 1 || e.stats.dex > 1 || e.stats.agi > 1))
    .sort((a, b) => a.cost - b.cost);

  function combatScore(stats) {
    return stats.str + stats.def + stats.dex + stats.agi;
  }

  function swapTargetForBase(baseValue) {
    return Math.max(swapMinAbs, Math.floor(baseValue * swapPct));
  }

  function prepBaseValue(stats, name) {
    if (prepDexFocus) return prepBaseDex.get(name) ?? stats.dex;
    return prepBaseCombat.get(name) ?? combatScore(stats);
  }

  function prepCurrentValue(stats) {
    if (prepDexFocus) return stats.dex;
    return combatScore(stats);
  }

  function meetsDexFloor(stats) {
    const maxOtherCombat = Math.max(stats.str, stats.def, stats.agi);
    if (maxOtherCombat <= 0) return true;
    return stats.dex >= maxOtherCombat * dexFloorRatio;
  }

  function buyGangEquipment(memberStats, combatRoleSet) {

    for (const { name, stats: mStats } of memberStats) {
      const memberInfo = ns.gang.getMemberInformation(name);
      const istAmTrainieren = memberInfo.task === "Train Hacking";
      const istWarrior = combatRoleSet.has(name);
      const equipList = istWarrior ? combatEquipments : hackEquipments;

      for (const equip of equipList) {
        const money = ns.getPlayer().money;

        // Schon gekauft?
        if (memberInfo.upgrades.includes(equip.name) || memberInfo.augmentations.includes(equip.name)) continue;
        // Genug Geld?
        if (money <= equip.cost + geldPuffer) continue;

        // ROI-Prüfung:
        // Beim Training immer kaufen — Equipment beschleunigt Stat-Wachstum
        // Im Crime-Modus (Hack-Equipment): Amortisationszeit berechnen
        let kaufen = false;
        if (istWarrior) {
          // War-Team priorisiert Combat-Stats statt ROI
          kaufen = true;
        } else if (istAmTrainieren || memberInfo.moneyGain <= 0) {
          kaufen = true; // Training-Equipment lohnt sich immer
        } else {
          // Zusätzlicher Gewinn pro Loop-Zyklus ≈ aktueller Gewinn × Hack-Multiplikator-Anteil
          const zusatzGewinnProZyklus = memberInfo.moneyGain * ((equip.stats.hack || 1) - 1);
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
    loopCount++;

    // Neue Mitglieder rekrutieren (while: manchmal sind mehrere auf einmal verfügbar)
    while (ns.gang.canRecruitMember()) {
      const newName = "GangMember_" + ns.gang.getMemberNames().length;
      ns.gang.recruitMember(newName);
    }

    const members = ns.gang.getMemberNames();
    const info = ns.gang.getGangInformation();
    const wantedPenalty = typeof info.wantedPenalty === "number" ? info.wantedPenalty : 1;
    const wantedLevelGain = typeof info.wantedLevelGain === "number"
      ? info.wantedLevelGain
      : (typeof info.wantedLevelGainRate === "number" ? info.wantedLevelGainRate : 0);
    const wantedLevel = typeof info.wantedLevel === "number" ? info.wantedLevel : 0;

    // Dynamische Respect-Schwelle für Cyberterrorism langsam anpassen
    if (loopCount % respectAdjustEveryLoops === 0) {
      const oldTarget = minRespectForCyberterrorism;
      if (wantedPenalty >= 0.97 && wantedLevelGain <= 0.01) {
        minRespectForCyberterrorism = Math.floor(minRespectForCyberterrorism * respectRaiseFactor);
      } else if (wantedPenalty < 0.94 || wantedLevelGain > 0.03) {
        minRespectForCyberterrorism = Math.floor(minRespectForCyberterrorism * respectLowerFactor);
      }

      minRespectForCyberterrorism = Math.max(
        minRespectForCyberterrorismMin,
        Math.min(minRespectForCyberterrorismMax, minRespectForCyberterrorism)
      );

      if (minRespectForCyberterrorism !== oldTarget) {
        ns.print(
          `[RESPECT-TARGET] ${ns.formatNumber(oldTarget)} -> ${ns.formatNumber(minRespectForCyberterrorism)} ` +
          `(penalty ${wantedPenalty.toFixed(3)}, wantedGain ${wantedLevelGain.toFixed(4)})`
        );
      }
    }

    // Aufgeräumt halten (falls Member entfernt/ersetzt wurden)
    for (const name of prepBaseCombat.keys()) {
      if (!members.includes(name)) {
        prepBaseCombat.delete(name);
        prepBaseDex.delete(name);
        prepDoneMembers.delete(name);
        activePrepCombatMembers.delete(name);
      }
    }

    const minHackers = Math.ceil(members.length * minHackShare);
    const maxWarriors = Math.max(0, members.length - minHackers);
    const powerFarmCount = Math.min(maxWarriors, Math.floor(members.length * powerFarmShare));

    // Member-Stats einmal pro Zyklus laden (nicht mehrfach pro Member)
    const memberStats = members.map(n => ({ name: n, stats: ns.gang.getMemberInformation(n) }));

    if (prepCombatMode) {
      // Neue Runde: Startwerte setzen
      for (const { name, stats } of memberStats) {
        if (!prepBaseCombat.has(name)) {
          prepBaseCombat.set(name, combatScore(stats));
        }
        if (!prepBaseDex.has(name)) {
          prepBaseDex.set(name, stats.dex);
        }
      }

      // Fortschritt prüfen (dynamisches Ziel je Member, optional DEX-fokussiert)
      for (const { name, stats } of memberStats) {
        const base = prepBaseValue(stats, name);
        const target = swapTargetForBase(base);
        const progressReached = prepCurrentValue(stats) - base >= target;
        const dexFloorReached = !prepDexFocus || meetsDexFloor(stats);
        if (progressReached && dexFloorReached) {
          prepDoneMembers.add(name);
        } else {
          prepDoneMembers.delete(name);
        }
      }

      // Wenn alle Members ihr Ziel erreicht haben, neue Runde starten
      if (memberStats.length > 0 && prepDoneMembers.size === memberStats.length) {
        prepRound++;
        prepDoneMembers.clear();
        activePrepCombatMembers.clear();
        for (const { name, stats } of memberStats) {
          prepBaseCombat.set(name, combatScore(stats));
          prepBaseDex.set(name, stats.dex);
        }
        ns.print(`Prep-Runde ${prepRound} gestartet (alle haben ihr ${prepDexFocus ? "DEX" : "Combat"}-Ziel erreicht).`);
      }
    } else {
      prepDoneMembers.clear();
    }

    // Clash-Chance über aktive Gegengangs mitteln
    const otherGangs = ns.gang.getOtherGangInformation();
    const enemyNames = Object.keys(otherGangs).filter(g => g !== info.faction && otherGangs[g].territory > 0);
    let avgClashChance = 0;
    if (enemyNames.length > 0) {
      avgClashChance = enemyNames.reduce((sum, g) => sum + ns.gang.getChanceToWinClash(g), 0) / enemyNames.length;
    }

    let territoryWarfareOn = false;
    if (!prepCombatMode && !powerFarmMode) {
      const warPrepMode = info.territory < territoryPrepTarget;
      if (warPrepMode && enemyNames.length > 0 && avgClashChance >= startWarChance) {
        territoryWarfareOn = true;
      }
      if (avgClashChance < stopWarChance) {
        territoryWarfareOn = false;
      }
    }
    ns.gang.setTerritoryWarfare(territoryWarfareOn);

    // Nur trainierte Members für Crime/Wanted-Logik heranziehen
    const trainedMembers = memberStats
      .filter(m => m.stats.hack >= minHackFuerCrime);

    // Combat-Rolle bestimmen:
    // - Prep-Mode: rotierende Trainingsgruppe, bis je Member +100 Combat erreicht sind
    // - Normal: Territory Warfare-Gruppe
    let combatRoleSet = new Set();
    if (prepCombatMode) {
      // 1) Genau einen fertigen Combat-Trainee pro Loop aus der aktiven Gruppe entfernen
      let removedThisLoop = null;
      let removedProgress = 0;
      let removedTarget = 0;
      for (const name of activePrepCombatMembers) {
        if (prepDoneMembers.has(name)) {
          const statsObj = memberStats.find(m => m.name === name);
          if (statsObj) {
            const base = prepBaseValue(statsObj.stats, name);
            removedProgress = Math.max(0, Math.floor(prepCurrentValue(statsObj.stats) - base));
            removedTarget = swapTargetForBase(base);
          }
          removedThisLoop = name;
          break;
        }
      }
      if (removedThisLoop !== null) {
        activePrepCombatMembers.delete(removedThisLoop);
      }

      // 2) Freie Slots auffüllen: bei normalem Betrieb genau einen neuen Member nachrutschen lassen
      // Beim Start (oder nach Recruit) kann bis zur Zielgröße aufgefüllt werden.
      const addedThisLoop = [];
      while (activePrepCombatMembers.size < maxWarriors) {
        const candidates = memberStats
          .slice()
          .filter(m => !prepDoneMembers.has(m.name) && !activePrepCombatMembers.has(m.name))
          .sort((a, b) => {
            if (prepDexFocus) return a.stats.dex - b.stats.dex;
            return combatScore(a.stats) - combatScore(b.stats);
          });

        if (candidates.length === 0) break;
        const added = candidates[0];
        activePrepCombatMembers.add(added.name);
        const addedLabel = prepDexFocus
          ? `${added.name} (DEX ${Math.floor(added.stats.dex)})`
          : `${added.name} (Combat ${Math.floor(combatScore(added.stats))})`;
        addedThisLoop.push(addedLabel);

        // Wenn nur ein Slot frei wurde, exakt ein Member nachrutschen lassen
        if (removedThisLoop !== null) break;
      }

      if (removedThisLoop !== null || addedThisLoop.length > 0) {
        const metric = prepDexFocus ? "DEX" : "Combat";
        const removeText = removedThisLoop !== null
          ? `${removedThisLoop} (+${removedProgress}/${removedTarget})`
          : "keiner";
        const addText = addedThisLoop.length > 0 ? addedThisLoop.join(", ") : "keiner";
        ns.print(`[PREP-SWAP ${metric}] raus: ${removeText} | rein: ${addText}`);
      }

      combatRoleSet = new Set(activePrepCombatMembers);
    } else if (powerFarmMode) {
      activePrepCombatMembers.clear();
      combatRoleSet = new Set(
        trainedMembers
          .slice()
          .sort((a, b) => combatScore(b.stats) - combatScore(a.stats))
          .slice(0, powerFarmCount)
          .map(m => m.name)
      );
    } else {
      activePrepCombatMembers.clear();
      combatRoleSet = new Set(
        trainedMembers
          .slice()
          .sort((a, b) => combatScore(b.stats) - combatScore(a.stats))
          .slice(0, territoryWarfareOn ? maxWarriors : 0)
          .map(m => m.name)
      );
    }

    const trainedMemberNames = trainedMembers.map(m => m.name);

    for (const { name, stats } of memberStats) {
      const istWarrior = combatRoleSet.has(name);

      // Ascension: Hacker über Hack-Mult, War-Team über Combat-Mults
      const res = ns.gang.getAscensionResult(name);
      if (res) {
        const shouldAscendHack = res.hack >= verbesserungsFaktor;
        const shouldAscendCombat = istWarrior && (
          res.str >= combatAscendFaktor ||
          res.def >= combatAscendFaktor ||
          res.dex >= combatAscendFaktor ||
          res.agi >= combatAscendFaktor
        );

        if (shouldAscendHack || shouldAscendCombat) {
          ns.gang.ascendMember(name);
          // Nach Ascension: Stats wurden zurückgesetzt → direkt trainieren
          ns.gang.setMemberTask(name, "Train Hacking");
          continue;
        }
      }

      // PRIORITÄT 1: Für Territory Wars vorgesehene Kämpfer
      if (istWarrior) {
        ns.gang.setMemberTask(name, prepCombatMode ? "Train Combat" : "Territory Warfare");
        continue;
      }

      // PRIORITÄT 0: Zu schwach für Crime → trainieren
      // (gilt auch für gerade-ascendete Members, da ihr hack-Stat zurückgesetzt wurde)
      if (stats.hack < minHackFuerCrime) {
        ns.gang.setMemberTask(name, "Train Hacking");
        continue;
      }

      // PRIORITÄT 2: Wanted Level senken
      if (wantedLevel > 5000 || wantedLevelGain > 0) {
        const threshold = wantedLevel > 10000 ? 0.7 : 0.3;
        const idx = trainedMemberNames.indexOf(name);
        const cleanerCount = Math.ceil(trainedMemberNames.length * threshold);
        ns.gang.setMemberTask(name, idx < cleanerCount ? "Ethical Hacking" : "Money Laundering");
      }
      // PRIORITÄT 3: Respekt farmen
      else if (info.respect < minRespectForCyberterrorism) {
        ns.gang.setMemberTask(name, "Cyberterrorism");
      }
      // PRIORITÄT 4: Geld verdienen
      else {
        ns.gang.setMemberTask(name, "Money Laundering");
      }
    }

    if (prepCombatMode && (loopCount % prepStatusEveryLoops === 0)) {
      const activeTrainees = memberStats
        .filter(m => combatRoleSet.has(m.name))
        .map(m => {
          const base = prepBaseValue(m.stats, m.name);
          const progress = Math.max(0, Math.floor(prepCurrentValue(m.stats) - base));
          const target = swapTargetForBase(base);
          return `${m.name} (+${progress}/${target})`;
        });

      const traineeText = activeTrainees.length > 0 ? activeTrainees.join(", ") : "keine";
      const metric = prepDexFocus ? "DEX" : "Combat";
      const dexFloorText = prepDexFocus ? ` | DEX-Floor: ${Math.floor(dexFloorRatio * 100)}%` : "";
      ns.print(
        `[PREP ${metric}] Runde ${prepRound} | Fertig: ${prepDoneMembers.size}/${memberStats.length} | Aktiv: ${activeTrainees.length}${dexFloorText} | RespectTarget: ${ns.formatNumber(minRespectForCyberterrorism)} | Trainees: ${traineeText}`
      );
    } else if (powerFarmMode && (loopCount % prepStatusEveryLoops === 0)) {
      const powerFarmers = memberStats
        .filter(m => combatRoleSet.has(m.name))
        .map(m => `${m.name} (Power ${Math.floor(combatScore(m.stats))})`);
      const powerFarmerText = powerFarmers.length > 0 ? powerFarmers.join(", ") : "keine";
      ns.print(
        `[POWER-FARM] Aktiv: ${powerFarmers.length} | Clashes: AUS | RespectTarget: ${ns.formatNumber(minRespectForCyberterrorism)} | Fighters: ${powerFarmerText}`
      );
    }

    buyGangEquipment(memberStats, combatRoleSet);
    await ns.sleep(loopDelayMs);
  }
}