/** @param {NS} ns */

import { ensureJsonFile } from "./runtime_file_utils.js";

const CRIME_TYPES = [
  "Shoplift",
  "Rob Store",
  "Mug",
  "Larceny",
  "Deal Drugs",
  "Bond Forgery",
  "Traffick Arms",
  "Homicide",
  "Grand Theft Auto",
  "Kidnap",
  "Assassination",
  "Heist",
];
const TRAINABLE_STATS = ["strength", "defense", "dexterity", "agility", "charisma"];
const DEFAULT_TRAINER_STATS = {
  strength: true,
  defense: true,
  dexterity: true,
  agility: true,
  charisma: false,
};

export async function main(ns) {
  if (!ns.singularity) {
    ns.tprint("Error: Singularity API not available. Requires Source-File 4.");
    return;
  }

  const DEFAULT_CONFIG_FILE = "main_manager_config.js";
  const configFile = String(ns.args[0] || DEFAULT_CONFIG_FILE);
  const CRIME_CHANCE_TARGET = 0.9;
  const CRIME_FOCUS = false;
  const DEFAULT_LOOP_MS = 15000;
  let loopMs = DEFAULT_LOOP_MS;
  try {
    const cfgRaw = ns.read(configFile);
    if (cfgRaw) loopMs = Number(JSON.parse(cfgRaw)?.services?.negativeKarma?.loopMs) || DEFAULT_LOOP_MS;
  } catch { /* use fallback */ }

  ns.disableLog("sleep");

  if (typeof ns.atExit === "function") {
    ns.atExit(() => {
      disableManagedCombatTrainer(ns, configFile);
    });
  }

  while (true) {
    ns.clearLog();

    const bestCrime = getBestKarmaCrime(ns);
    if (!bestCrime) {
      ns.print("NEGATIVE KARMA");
      ns.print("");
      ns.print("No suitable crime with karma found.");
      await ns.sleep(loopMs);
      continue;
    }

    const currentWork = typeof ns.singularity.getCurrentWork === "function"
      ? ns.singularity.getCurrentWork()
      : null;

    if (bestCrime.chance < CRIME_CHANCE_TARGET) {
      enableCombatTrainerForCrime(ns, configFile, bestCrime.trainingStats);
      if (isCrimeWork(currentWork) && typeof ns.singularity.stopAction === "function") {
        ns.singularity.stopAction();
      }
      printStatus(ns, bestCrime, true);
    } else {
      disableManagedCombatTrainer(ns, configFile);
      if (!isCrimeWork(currentWork, bestCrime.type)) {
        ns.singularity.commitCrime(bestCrime.type, CRIME_FOCUS);
      }
      printStatus(ns, bestCrime, false);
    }

    await ns.sleep(loopMs);
  }
}

function loadConfig(ns, configFile) {
  const fallback = {
    loopMs: 5000,
    tail: true,
    services: {},
  };

  const fileState = ensureJsonFile(ns, configFile, fallback);
  const parsed = fileState.value && typeof fileState.value === "object" ? fileState.value : fallback;
  return {
    loopMs: Number(parsed.loopMs) || fallback.loopMs,
    tail: parsed.tail !== false,
    services: parsed.services && typeof parsed.services === "object" ? parsed.services : {},
  };
}

function saveConfig(ns, configFile, config) {
  ns.write(configFile, JSON.stringify(config, null, 2), "w");
}

function sanitizeTrainerSelection(selection) {
  const sanitized = { ...DEFAULT_TRAINER_STATS };
  if (!selection || typeof selection !== "object") {
    return sanitized;
  }

  for (const stat of TRAINABLE_STATS) {
    sanitized[stat] = Boolean(selection[stat]);
  }

  return sanitized;
}

function buildTrainerSelection(stats) {
  const selection = {
    strength: false,
    defense: false,
    dexterity: false,
    agility: false,
    charisma: false,
  };

  for (const stat of stats) {
    if (stat in selection) {
      selection[stat] = true;
    }
  }

  if (!Object.values(selection).some(Boolean)) {
    return { ...DEFAULT_TRAINER_STATS };
  }

  return selection;
}

function enableCombatTrainerForCrime(ns, configFile, stats) {
  const config = loadConfig(ns, configFile);
  const service = config.services.negativeKarma || {};
  const combatTrainer = config.services.combatTrainer || {};
  const nextStats = buildTrainerSelection(stats);
  const currentStats = sanitizeTrainerSelection(combatTrainer.stats);
  const nextArgs = Array.isArray(combatTrainer.args)
    ? combatTrainer.args
    : [configFile, false, "Leadership"];
  const changed = combatTrainer.enabled !== true
    || JSON.stringify(currentStats) !== JSON.stringify(nextStats)
    || !Array.isArray(combatTrainer.args)
    || service.trainerManaged !== true;

  if (!changed) {
    return;
  }

  config.services.combatTrainer = {
    ...combatTrainer,
    enabled: true,
    threads: combatTrainer.threads ?? 1,
    args: nextArgs,
    stats: nextStats,
  };
  config.services.negativeKarma = {
    ...service,
    enabled: service.enabled ?? true,
    threads: service.threads ?? 1,
    args: Array.isArray(service.args) ? service.args : [configFile],
    trainerManaged: true,
  };
  saveConfig(ns, configFile, config);
}

function disableManagedCombatTrainer(ns, configFile) {
  const config = loadConfig(ns, configFile);
  const service = config.services.negativeKarma || {};
  if (service.trainerManaged !== true) {
    return;
  }

  const combatTrainer = config.services.combatTrainer || {};
  config.services.combatTrainer = {
    ...combatTrainer,
    enabled: false,
    threads: combatTrainer.threads ?? 1,
    args: Array.isArray(combatTrainer.args) ? combatTrainer.args : [configFile, false, "Leadership"],
    stats: sanitizeTrainerSelection(combatTrainer.stats),
  };
  config.services.negativeKarma = {
    ...service,
    enabled: service.enabled ?? false,
    threads: service.threads ?? 1,
    args: Array.isArray(service.args) ? service.args : [configFile],
    trainerManaged: false,
  };
  saveConfig(ns, configFile, config);
}

export function getCrimeTrainingStats(crimeStats) {
  const mapping = [
    ["strength_success_weight", "strength"],
    ["defense_success_weight", "defense"],
    ["dexterity_success_weight", "dexterity"],
    ["agility_success_weight", "agility"],
    ["charisma_success_weight", "charisma"],
  ];

  return mapping
    .filter(([field]) => Number(crimeStats?.[field] || 0) > 0)
    .map(([, stat]) => stat);
}

export function getBestKarmaCrime(ns) {
  const crimes = CRIME_TYPES
    .map(type => {
      const stats = ns.singularity.getCrimeStats(type);
      const timeMs = Number(stats?.time || 0);
      const karma = Number(stats?.karma || 0);
      const chance = Number(ns.singularity.getCrimeChance(type) || 0);
      const trainingStats = getCrimeTrainingStats(stats);

      return {
        type,
        chance,
        timeMs,
        karma,
        trainingStats,
        karmaPerSecond: timeMs > 0 ? karma / (timeMs / 1000) : 0,
      };
    })
    .filter(crime => crime.timeMs > 0 && crime.karma > 0)
    .sort((left, right) => {
      if (right.karmaPerSecond !== left.karmaPerSecond) return right.karmaPerSecond - left.karmaPerSecond;
      if (right.chance !== left.chance) return right.chance - left.chance;
      return left.timeMs - right.timeMs;
    });

  return crimes[0] || null;
}

function isCrimeWork(work, crimeType) {
  if (!work || typeof work !== "object") {
    return false;
  }

  if (String(work.type || "").toLowerCase() !== "crime") {
    return false;
  }

  return !crimeType || String(work.crimeType || "") === crimeType;
}

function printStatus(ns, crime, trainingMode) {
  const chancePct = (crime.chance * 100).toFixed(1);
  const statsText = crime.trainingStats.length > 0
    ? crime.trainingStats.map(stat => stat.slice(0, 3).toUpperCase()).join(", ")
    : "none";

  ns.print("NEGATIVE KARMA");
  ns.print("");
  ns.print(`Crime: ${crime.type}`);
  ns.print(`Karma/s: ${crime.karmaPerSecond.toFixed(3)}`);
  ns.print(`Chance: ${chancePct}%`);
  ns.print(`Mode: ${trainingMode ? "Training for 90%" : "Farming Crime"}`);
  ns.print(`Trainer Stats: ${statsText}`);
}