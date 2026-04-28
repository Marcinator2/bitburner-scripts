/** @param {NS} ns */
export async function main(ns) {
  const CONFIG_FILE = "main_manager_config.js";
  const DEFAULT_LOOP_MS = 2000;

  // Stamina thresholds
  const STAMINA_REST_BELOW = 0.4;     // Start resting when stamina drops below 40%
  const STAMINA_RESUME_ABOVE = 0.9;   // Resume actions once stamina recovers above 90%

  // Chaos thresholds
  const CHAOS_DIPLOMACY_ABOVE = 50;   // Switch to Diplomacy when chaos exceeds this
  const CHAOS_STOP_DIPLOMACY = 20;    // Stop Diplomacy once chaos falls below this
  const CHAOS_INCITE_BELOW = 35;      // Use Incite Violence only when chaos is below this

  // Success chance thresholds
  const BLACKOP_MIN_CHANCE = 0.9;     // Require 90% chance before attempting Black Ops
  const MIN_OP_CHANCE = 0.8;          // Prefer operations with at least 80% chance
  const MIN_CONTRACT_CHANCE = 0.5;    // Accept contracts at 50% chance

  // Skill upgrade priority (highest first)
  const SKILL_PRIORITY = [
    "Blade's Intuition",
    "Cloak",
    "Short-Circuit",
    "Digital Observer",
    "Datamancer",
    "Overclock",
    "Hyperdrive",
    "Reaper",
    "Evasion",
    "Tracer",
    "Cyber's Edge",
    "Hands of Midas",
  ];

  if (!ns.bladeburner) {
    ns.tprint("[Bladeburner] Error: Bladeburner API not available.");
    return;
  }

  if (!ns.bladeburner.inBladeburner()) {
    ns.tprint("[Bladeburner] Not enrolled in Bladeburner division. Exiting.");
    return;
  }

  ns.disableLog("ALL");

  let loopMs = DEFAULT_LOOP_MS;
  let isResting = false;
  let isDiplomacy = false;

  while (true) {
    ns.clearLog();

    try {
      const cfgRaw = ns.read(CONFIG_FILE);
      if (cfgRaw) {
        const parsed = JSON.parse(cfgRaw);
        loopMs = Number(parsed?.services?.bladeburner?.loopMs) || DEFAULT_LOOP_MS;
      }
    } catch { /* use fallback */ }

    spendSkillPoints(ns, SKILL_PRIORITY);
    switchToBestCity(ns);

    const [curStamina, maxStamina] = ns.bladeburner.getStamina();
    const staminaRatio = maxStamina > 0 ? curStamina / maxStamina : 1;
    const city = ns.bladeburner.getCity();
    const chaos = ns.bladeburner.getCityChaos(city);
    const rank = ns.bladeburner.getRank();

    // Stamina state machine
    if (!isResting && staminaRatio < STAMINA_REST_BELOW) isResting = true;
    if (isResting && staminaRatio >= STAMINA_RESUME_ABOVE) isResting = false;

    // Chaos state machine
    if (!isDiplomacy && chaos > CHAOS_DIPLOMACY_ABOVE) isDiplomacy = true;
    if (isDiplomacy && chaos <= CHAOS_STOP_DIPLOMACY) isDiplomacy = false;

    const anyAvailable = anyActionAvailable(ns);
    const allDepleted = !anyAvailable;

    let nextAction;
    let trainingReason = "";
    if (isResting) {
      nextAction = { type: "General", name: "Hyperbolic Regeneration Chamber" };
    } else if (isDiplomacy) {
      nextAction = { type: "General", name: "Diplomacy" };
    } else {
      const bestBlackOp = getBestBlackOp(ns, rank, BLACKOP_MIN_CHANCE);
      const bestOp = getBestOperation(ns, MIN_OP_CHANCE);
      const bestContract = getBestContract(ns, MIN_CONTRACT_CHANCE);

      if (bestBlackOp) {
        nextAction = bestBlackOp;
      } else if (bestOp) {
        nextAction = bestOp;
      } else if (bestContract) {
        nextAction = bestContract;
      } else if (!allDepleted) {
        // Actions exist but all chances are too low — train combat stats
        nextAction = { type: "General", name: "Training" };
        const bestAvailOp = getBestOperation(ns, 0) ?? getBestContract(ns, 0);
        if (bestAvailOp) {
          const ch = getChanceMin(ns, bestAvailOp.type, bestAvailOp.name);
          trainingReason = `best chance: ${(ch * 100).toFixed(0)}%`;
        }
      } else if (allDepleted && chaos < CHAOS_INCITE_BELOW) {
        nextAction = { type: "General", name: "Incite Violence" };
      } else {
        nextAction = { type: "General", name: "Field Analysis" };
      }
    }

    const current = ns.bladeburner.getCurrentAction();
    if (!current || current.type !== nextAction.type || current.name !== nextAction.name) {
      ns.bladeburner.startAction(nextAction.type, nextAction.name);
    }

    // Status output
    const bonusSec = Math.floor(ns.bladeburner.getBonusTime() / 1000);
    ns.print("=== BLADEBURNER MANAGER ===");
    ns.print(`Rank: ${ns.formatNumber(rank, 2)}  |  SP: ${ns.bladeburner.getSkillPoints()}`);
    ns.print(`Stamina: ${curStamina.toFixed(1)} / ${maxStamina.toFixed(1)}  (${(staminaRatio * 100).toFixed(0)}%)`);
    ns.print(`City: ${city}  |  Chaos: ${chaos.toFixed(2)}`);
    ns.print(`Bonus Time: ${bonusSec}s`);
    ns.print("");

    const act = ns.bladeburner.getCurrentAction();
    if (act && act.type && act.type !== "Idle") {
      const chStr = getChanceStr(ns, act.type, act.name);
      ns.print(`Action: ${act.type} / ${act.name}  ${chStr}`);
    } else {
      ns.print("Action: Idle");
    }

    if (isResting) ns.print("[RESTING - low stamina]");
    if (isDiplomacy) ns.print("[DIPLOMACY - reducing chaos]");
    if (nextAction.name === "Training") ns.print(`[TRAINING - stats too low (${trainingReason})]`);

    await ns.sleep(loopMs);
  }
}

function spendSkillPoints(ns, skillPriority) {
  let sp = ns.bladeburner.getSkillPoints();
  if (sp <= 0) return;

  for (const skill of skillPriority) {
    try {
      let cost = ns.bladeburner.getSkillUpgradeCost(skill, 1);
      while (isFinite(cost) && cost > 0 && sp >= cost) {
        if (!ns.bladeburner.upgradeSkill(skill)) break;
        sp = ns.bladeburner.getSkillPoints();
        cost = ns.bladeburner.getSkillUpgradeCost(skill, 1);
      }
    } catch { /* skip unknown skills */ }
  }
}

function switchToBestCity(ns) {
  if (typeof ns.bladeburner.switchCity !== "function") return;

  const CITIES = ["Aevum", "Chongqing", "Ishima", "New Tokyo", "Sector-12", "Volhaven"];
  const currentCity = ns.bladeburner.getCity();
  let bestCity = currentCity;
  let bestScore = getCityScore(ns, currentCity);

  for (const city of CITIES) {
    const score = getCityScore(ns, city);
    if (score > bestScore) {
      bestScore = score;
      bestCity = city;
    }
  }

  if (bestCity !== currentCity) {
    ns.bladeburner.switchCity(bestCity);
  }
}

function getCityScore(ns, city) {
  const pop = ns.bladeburner.getCityEstimatedPopulation(city);
  const chaos = ns.bladeburner.getCityChaos(city);
  // Penalize chaos: each chaos point reduces effective population score
  return pop * Math.max(0, 1 - chaos / 100);
}

function getChanceMin(ns, type, name) {
  if (typeof ns.bladeburner.getActionSuccessChance !== "function") return 0;
  const ch = ns.bladeburner.getActionSuccessChance(type, name);
  if (Array.isArray(ch)) return ch[0];
  if (typeof ch === "number") return ch;
  return 0;
}

function getChanceStr(ns, type, name) {
  if (typeof ns.bladeburner.getActionSuccessChance !== "function") return "";
  const ch = ns.bladeburner.getActionSuccessChance(type, name);
  if (Array.isArray(ch)) return `[${(ch[0] * 100).toFixed(0)}-${(ch[1] * 100).toFixed(0)}%]`;
  if (typeof ch === "number") return `[${(ch * 100).toFixed(0)}%]`;
  return "";
}

function getBestBlackOp(ns, rank, minChance) {
  const blackOps = ns.bladeburner.getBlackOpNames();
  for (const name of blackOps) {
    const requiredRank = ns.bladeburner.getBlackOpRank(name);
    if (rank < requiredRank) continue;
    const remaining = ns.bladeburner.getActionCountRemaining("BlackOp", name);
    if (remaining <= 0) continue;
    const chance = getChanceMin(ns, "BlackOp", name);
    if (chance < minChance) continue;
    return { type: "BlackOp", name };
  }
  return null;
}

function getBestOperation(ns, minChance) {
  const ops = ns.bladeburner.getOperationNames();
  const candidates = ops
    .map(name => {
      const remaining = ns.bladeburner.getActionCountRemaining("Operation", name);
      if (remaining <= 0) return null;
      const chance = getChanceMin(ns, "Operation", name);
      if (chance < minChance) return null;
      return { name, chance };
    })
    .filter(Boolean)
    .sort((a, b) => b.chance - a.chance);

  return candidates.length > 0 ? { type: "Operation", name: candidates[0].name } : null;
}

function getBestContract(ns, minChance) {
  const contracts = ns.bladeburner.getContractNames();
  const candidates = contracts
    .map(name => {
      const remaining = ns.bladeburner.getActionCountRemaining("Contract", name);
      if (remaining <= 0) return null;
      const chance = getChanceMin(ns, "Contract", name);
      if (chance < minChance) return null;
      return { name, chance };
    })
    .filter(Boolean)
    .sort((a, b) => b.chance - a.chance);

  return candidates.length > 0 ? { type: "Contract", name: candidates[0].name } : null;
}

function anyActionAvailable(ns) {
  const ops = ns.bladeburner.getOperationNames();
  const contracts = ns.bladeburner.getContractNames();
  return [...ops, ...contracts].some(name => {
    const type = ops.includes(name) ? "Operation" : "Contract";
    return ns.bladeburner.getActionCountRemaining(type, name) > 0;
  });
}
