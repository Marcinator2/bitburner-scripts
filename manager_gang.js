/** @param {NS} ns */
export async function main(ns) {
  const configFile = String(ns.args[0] || "main_manager_config.txt");
  //ns.disableLog("ALL");

  const ascensionFactor = 1.8; // Ascension multiplier threshold (hack mult must increase by this factor)
  const combatAscendFactor = 1.35; // Combat ascension threshold for war team
  const minHackForCrime = 200;    // Hack stat threshold: below this → train instead of Crime
  const minHackShare = 0.2;       // Minimum 50% of gang stays on hacking tasks
  const powerFarmMode = false;      // true = farm Power via Territory Warfare, but without Clashes
  const powerFarmShare = 0.8;     // Fraction of gang for Power farming, additionally limited by minHackShare
  const prepDexFocus = false;       // true = swap based on DEX progress, false = based on combat sum
  const dexFloorRatio = 0.6;       // With DEX focus: dex must be at least X% of the highest other combat stat
  const swapMinAbs = 120;          // Absolute minimum progress for swap
  const swapPct = 0.2;             // Relative progress for swap (0.2 = 20% of base value)
  const territoryPrepTarget = 0.98; // Actively prepare territory up to this value
  const startWarChance = 0.60;     // Enable Territory Warfare at this average chance
  const stopWarChance = 0.52;      // Disable Territory Warfare below this average chance
  const moneyBuffer = 10_000_000;   // Minimum money on account after equipment purchase
  const maxAmortizationHours = 4; // Equipment is only bought if it pays off within X game hours
  const loopDelayMs = 2000;         // Loop time in ms (must match ns.sleep)
  const prepStatusEveryLoops = 5;   // Status output only every X loops
  const minRespectForCyberterrorismMin = 12_500_000; // Lower bound for dynamic Cyberterrorism threshold
  const minRespectForCyberterrorismMax = 20_000_000; // Upper bound for dynamic Cyberterrorism threshold
  const respectRaiseFactor = 1.2;   // Threshold rises with stable wanted situation
  const respectLowerFactor = 0.9;   // Threshold drops with unstable wanted situation
  const respectAdjustEveryLoops = 30; // Adjustment every X loops (at 2s loop = 60s)

  function loadGangConfig() {
    try {
      const raw = ns.read(configFile);
      if (!raw || !raw.trim()) {
        return { autoAscend: true, autoEquipment: true, autoTerritoryWarfare: true, prepCombatMode: false };
      }

      const parsed = JSON.parse(raw);
      const gang = parsed?.services?.gang;
      return {
        autoAscend: gang?.autoAscend ?? true,
        autoEquipment: gang?.autoEquipment ?? true,
        autoTerritoryWarfare: gang?.autoTerritoryWarfare ?? true,
        prepCombatMode: gang?.prepCombatMode ?? false,
      };
    } catch {
      return { autoAscend: true, autoEquipment: true, autoTerritoryWarfare: true, prepCombatMode: false };
    }
  }

  if (!ns.gang || typeof ns.gang.inGang !== "function") {
    ns.tprint("Error: Gang API not available.");
    return;
  }

  if (!ns.gang.inGang()) {
    ns.tprint("Not in a gang yet. manager_gang.js terminating.");
    return;
  }

  const allServers = ns.scan("home").filter(s => s !== "home");
  const visited = new Set(["home"]);
  const prepBaseCombat = new Map(); // name -> combat base value
  const prepBaseDex = new Map(); // name -> DEX base value
  const prepDoneMembers = new Set(); // Members who have reached +100
  const activePrepCombatMembers = new Set(); // Current combat training group (stable until +100 reached)
  let prepRound = 1;
  let loopCount = 0;
  let minRespectForCyberterrorism = 2_000_000;

  // Pre-calculate equipment lists sorted by price
  const hackEquipments = ns.gang.getEquipmentNames()
    .map(e => ({ name: e, cost: ns.gang.getEquipmentCost(e), stats: ns.gang.getEquipmentStats(e) }))
    .filter(e => e.stats.hack > 1) // Hack-relevant only
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
      const isTraining = memberInfo.task === "Train Hacking";
      const isWarrior = combatRoleSet.has(name);
      const equipList = isWarrior ? combatEquipments : hackEquipments;

      for (const equip of equipList) {
        const money = ns.getPlayer().money;

        // Already purchased?
        if (memberInfo.upgrades.includes(equip.name) || memberInfo.augmentations.includes(equip.name)) continue;
        // Enough money?
        if (money <= equip.cost + moneyBuffer) continue;

        // ROI check:
        // While training always buy — equipment accelerates stat growth
        // In crime mode (hack equipment): calculate amortization time
        let shouldBuy = false;
        if (isWarrior) {
          // War team prioritizes combat stats over ROI
          shouldBuy = true;
        } else if (isTraining || memberInfo.moneyGain <= 0) {
          shouldBuy = true; // Training equipment is always worth it
        } else {
          // Additional profit per loop cycle ≈ current profit × hack multiplier portion
          const additionalProfitPerCycle = memberInfo.moneyGain * ((equip.stats.hack || 1) - 1);
          if (additionalProfitPerCycle > 0) {
            const amortizationMs = (equip.cost / additionalProfitPerCycle) * loopDelayMs;
            const amortizationHours = amortizationMs / (1000 * 60 * 60);
            shouldBuy = amortizationHours <= maxAmortizationHours;
            if (!shouldBuy) {
              ns.print(`SKIP: ${equip.name} for ${name} — amortization: ${amortizationHours.toFixed(1)}h (limit: ${maxAmortizationHours}h)`);
            }
          }
        }

        if (shouldBuy && ns.gang.purchaseEquipment(name, equip.name)) {
          const reason = isTraining ? "Training" : "ROI ok";
          ns.print(`BUY [${reason}]: ${name} → ${equip.name} (${ns.formatNumber(equip.cost)})`);
        }
      }
    }
  }

  while (true) {
    loopCount++;
    const gangConfig = loadGangConfig();
    const prepCombatMode = gangConfig.prepCombatMode;

    // Recruit new members (while: sometimes multiple are available at once)
    while (ns.gang.canRecruitMember()) {
      const newName = "GangMember_" + ns.gang.getMemberNames().length;
      ns.gang.recruitMember(newName);
    }

    const members = ns.gang.getMemberNames();
    const info = ns.gang.getGangInformation();
    const wantedPenalty = typeof info.wantedPenalty === "number" ? info.wantedPenalty : 1;
    const wantedLevelGain = typeof info.wantedLevelGainRate === "number" ? info.wantedLevelGainRate : 0;
    const wantedLevel = typeof info.wantedLevel === "number" ? info.wantedLevel : 0;

    // Dynamic respect threshold for Cyberterrorism: slowly adjust
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

    // Keep clean (in case members were removed/replaced)
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

    // Load member stats once per cycle (not multiple times per member)
    const memberStats = members.map(n => ({ name: n, stats: ns.gang.getMemberInformation(n) }));

    if (prepCombatMode) {
      // New round: set base values
      for (const { name, stats } of memberStats) {
        if (!prepBaseCombat.has(name)) {
          prepBaseCombat.set(name, combatScore(stats));
        }
        if (!prepBaseDex.has(name)) {
          prepBaseDex.set(name, stats.dex);
        }
      }

      // Check progress (dynamic target per member, optionally DEX-focused)
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

      // When all members have reached their target, start a new round
      if (memberStats.length > 0 && prepDoneMembers.size === memberStats.length) {
        prepRound++;
        prepDoneMembers.clear();
        activePrepCombatMembers.clear();
        for (const { name, stats } of memberStats) {
          prepBaseCombat.set(name, combatScore(stats));
          prepBaseDex.set(name, stats.dex);
        }
        ns.print(`Prep round ${prepRound} started (all members reached their ${prepDexFocus ? "DEX" : "Combat"} target).`);
      }
    } else {
      prepDoneMembers.clear();
    }

    // Average clash chance across active enemy gangs
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
      if (!gangConfig.autoTerritoryWarfare) {
        territoryWarfareOn = false;
      }
    ns.gang.setTerritoryWarfare(territoryWarfareOn);

    // Only use trained members for Crime/Wanted logic
    const trainedMembers = memberStats
      .filter(m => m.stats.hack >= minHackForCrime);

    // Combat role assignment:
    // - Prep mode: rotating training group, until each member gained +100 Combat
    // - Normal: Territory Warfare group
    let combatRoleSet = new Set();
    if (prepCombatMode) {
      // 1) Remove exactly one finished combat trainee per loop from the active group
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

      // 2) Fill free slots: during normal operation let exactly one new member slot in
      // At startup (or after recruit) can fill up to target size.
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

        // If only one slot opened, let exactly one member slot in
        if (removedThisLoop !== null) break;
      }

      if (removedThisLoop !== null || addedThisLoop.length > 0) {
        const metric = prepDexFocus ? "DEX" : "Combat";
        const removeText = removedThisLoop !== null
          ? `${removedThisLoop} (+${removedProgress}/${removedTarget})`
          : "none";
        const addText = addedThisLoop.length > 0 ? addedThisLoop.join(", ") : "none";
        ns.print(`[PREP-SWAP ${metric}] out: ${removeText} | in: ${addText}`);
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
      const isWarrior = combatRoleSet.has(name);

      // Ascension: Hackers by hack mult, War team by combat mults
      const res = ns.gang.getAscensionResult(name);
      if (gangConfig.autoAscend && res) {
        const shouldAscendHack = res.hack >= ascensionFactor;
        const shouldAscendCombat = isWarrior && (
          res.str >= combatAscendFactor ||
          res.def >= combatAscendFactor ||
          res.dex >= combatAscendFactor ||
          res.agi >= combatAscendFactor
        );

        if (shouldAscendHack || shouldAscendCombat) {
          ns.gang.ascendMember(name);
          // After ascension: stats were reset → train immediately
          ns.gang.setMemberTask(name, "Train Hacking");
          continue;
        }
      }

      // PRIORITY 1: Fighters designated for Territory Wars
      if (isWarrior) {
        ns.gang.setMemberTask(name, prepCombatMode ? "Train Combat" : "Territory Warfare");
        continue;
      }

      // PRIORITY 0: Too weak for Crime → train
      // (also applies to freshly-ascended members since their hack stat was reset)
      if (stats.hack < minHackForCrime) {
        ns.gang.setMemberTask(name, "Train Hacking");
        continue;
      }

      // PRIORITY 2: Lower Wanted Level
      if (wantedLevel > 5000 || wantedLevelGain > 0) {
        // If Wanted is actively growing → everyone cleans; otherwise only a portion
        const threshold = wantedLevelGain > 0 ? 1.0 : (wantedLevel > 10000 ? 0.7 : 0.5);
        const idx = trainedMemberNames.indexOf(name);
        const cleanerCount = Math.ceil(trainedMemberNames.length * threshold);
        ns.gang.setMemberTask(name, idx < cleanerCount ? "Ethical Hacking" : "Money Laundering");
      }
      // PRIORITY 3: Farm respect
      else if (info.respect < minRespectForCyberterrorism) {
        ns.gang.setMemberTask(name, "Cyberterrorism");
      }
      // PRIORITY 4: Make money
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

      const traineeText = activeTrainees.length > 0 ? activeTrainees.join(", ") : "none";
      const metric = prepDexFocus ? "DEX" : "Combat";
      const dexFloorText = prepDexFocus ? ` | DEX-Floor: ${Math.floor(dexFloorRatio * 100)}%` : "";
      ns.print(
        `[PREP ${metric}] Round ${prepRound} | Done: ${prepDoneMembers.size}/${memberStats.length} | Active: ${activeTrainees.length}${dexFloorText} | RespectTarget: ${ns.formatNumber(minRespectForCyberterrorism)} | Trainees: ${traineeText}`
      );
    } else if (powerFarmMode && (loopCount % prepStatusEveryLoops === 0)) {
      const powerFarmers = memberStats
        .filter(m => combatRoleSet.has(m.name))
        .map(m => `${m.name} (Power ${Math.floor(combatScore(m.stats))})`);
      const powerFarmerText = powerFarmers.length > 0 ? powerFarmers.join(", ") : "none";
      ns.print(
        `[POWER-FARM] Active: ${powerFarmers.length} | Clashes: OFF | RespectTarget: ${ns.formatNumber(minRespectForCyberterrorism)} | Fighters: ${powerFarmerText}`
      );
    }

    if (gangConfig.autoEquipment) {
      buyGangEquipment(memberStats, combatRoleSet);
    }
    await ns.sleep(loopDelayMs);
  }
}