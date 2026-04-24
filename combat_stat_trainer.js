/** @param {NS} ns */

import { ensureJsonFile } from "./runtime_file_utils.js";
import {
  GYM_LOCATIONS,
  UNIVERSITY_LOCATIONS,
  getConfiguredLocation,
  normalizeUniversityCourse,
  selectBestGym,
  selectBestUniversity,
} from "./training_location_utils.js";

const DEFAULT_CONFIG_FILE = "main_manager_config.js";
const DEFAULT_FOCUS = false;
const DEFAULT_CHARISMA_COURSE = "Leadership";
const CHECK_INTERVAL_MS = 15000;
const TRAINABLE_STATS = ["strength", "defense", "dexterity", "agility", "charisma"];
const SERVICE_KEY = "combatTrainer";

export async function main(ns) {
  if (!ns.singularity) {
    ns.tprint("Error: Singularity API not available. Requires Source-File 4.");
    return;
  }

  const configFile = String(ns.args[0] || DEFAULT_CONFIG_FILE);

  ns.disableLog("sleep");
  ns.tail();

  let currentStat = "";

  while (true) {
    ns.clearLog();

    const trainerConfig = loadTrainerConfig(ns, configFile);
    const player = ns.getPlayer();
    const playerSkills = player.skills;
    const selectedStats = getSelectedStats(trainerConfig.stats);
    const nextStat = pickNextStat(playerSkills, selectedStats);
    const gymChoice = resolveGymChoice(ns, trainerConfig, player, nextStat || "strength");
    const universityChoice = resolveUniversityChoice(ns, trainerConfig, player);

    printStatus(ns, playerSkills, trainerConfig, selectedStats, currentStat, gymChoice, universityChoice);

    if (!nextStat) {
      if (currentStat) {
        stopCurrentAction(ns);
        currentStat = "";
      }

      ns.print("");
      ns.print("No combat stats selected. Waiting for change...");
      await ns.sleep(CHECK_INTERVAL_MS);
      continue;
    }

    if (currentStat !== nextStat) {
      const started = startTraining(ns, trainerConfig, nextStat, gymChoice, universityChoice);
      if (!started) {
        ns.print(`Error: Training for ${nextStat} could not be started.`);
        await ns.sleep(CHECK_INTERVAL_MS);
        continue;
      }

      currentStat = nextStat;
    }

    ns.print("");
    ns.print(`Training now: ${currentStat.toUpperCase()}`);
    await ns.sleep(CHECK_INTERVAL_MS);
  }
}

function loadTrainerConfig(ns, configFile) {
  const fallback = {
    charismaCourse: DEFAULT_CHARISMA_COURSE,
    focus: DEFAULT_FOCUS,
    stats: createDefaultStatSelection(),
  };

  try {
    const fileState = ensureJsonFile(ns, configFile, {
      loopMs: 5000,
      tail: true,
      services: {
        combatTrainer: {
          enabled: false,
          threads: 1,
          args: [DEFAULT_CONFIG_FILE, DEFAULT_FOCUS, DEFAULT_CHARISMA_COURSE],
          stats: createDefaultStatSelection(),
        },
      },
    });
    const parsed = fileState.value;
    const service = parsed?.services?.[SERVICE_KEY] || {};
    const args = Array.isArray(service.args) ? service.args : [];
    const usesLegacyArgs = args.length >= 7;
    const rawCharismaCourse = usesLegacyArgs ? args[6] : args[2];
    return {
      focus: usesLegacyArgs ? Boolean(args[3]) : Boolean(args[1]),
      charismaCourse: normalizeUniversityCourse(rawCharismaCourse || DEFAULT_CHARISMA_COURSE),
      stats: sanitizeStatSelection(service.stats),
    };
  } catch {
    return fallback;
  }
}

function ensureCity(ns, city) {
  const player = ns.getPlayer();
  if (player.city === city) {
    return true;
  }

  if (typeof ns.singularity.travelToCity !== "function") {
    return false;
  }

  return ns.singularity.travelToCity(city);
}

function startTraining(ns, trainerConfig, stat, gymChoice, universityChoice) {
  if (stat === "charisma") {
    if (typeof ns.singularity.universityCourse !== "function") {
      return false;
    }

    const chosenUniversity = universityChoice || resolveUniversityChoice(ns, trainerConfig);
    const courseName = normalizeUniversityCourse(trainerConfig.charismaCourse);

    if (!ensureCity(ns, chosenUniversity.city)) {
      return false;
    }

    return ns.singularity.universityCourse(
      chosenUniversity.name,
      courseName,
      trainerConfig.focus,
    );
  }

  if (typeof ns.singularity.gymWorkout !== "function") {
    return false;
  }

  const chosenGym = gymChoice || resolveGymChoice(ns, trainerConfig, ns.getPlayer(), stat);

  if (!ensureCity(ns, chosenGym.city)) {
    return false;
  }

  return ns.singularity.gymWorkout(chosenGym.name, stat, trainerConfig.focus);
}

function pickNextStat(skills, selectedStats) {
  let nextStat = "";
  let lowestValue = Number.POSITIVE_INFINITY;

  for (const stat of selectedStats) {
    const value = Number(skills[stat] || 0);
    if (value < lowestValue) {
      lowestValue = value;
      nextStat = stat;
    }
  }

  return nextStat;
}

function printStatus(ns, skills, trainerConfig, selectedStats, currentStat, gymChoice, universityChoice) {
  ns.print("STAT TRAINER");
  ns.print("");
  ns.print(`Config: ${DEFAULT_CONFIG_FILE}`);
  ns.print(`Combat: ${gymChoice.city} | Gym: ${gymChoice.name}`);
  ns.print(`Gym-Wahl: ${gymChoice.reason}`);
  ns.print(`Charisma: ${universityChoice.city} | Uni: ${universityChoice.name}`);
  ns.print(`Kurs: ${trainerConfig.charismaCourse}`);
  ns.print(`Uni-Wahl: ${universityChoice.reason}`);
  ns.print(`Focus: ${trainerConfig.focus ? "ON" : "OFF"}`);
  ns.print("");
  ns.print(`Active stats: ${selectedStats.length > 0 ? selectedStats.map(formatStatName).join(", ") : "none"}`);
  ns.print(`Aktuell: ${currentStat ? formatStatName(currentStat) : "idle"}`);
  ns.print("");

  for (const stat of TRAINABLE_STATS) {
    const current = skills[stat];
    const enabled = trainerConfig.stats[stat] ? "[x]" : "[ ]";
    ns.print(`${enabled} ${formatStatName(stat)} ${padLeft(current, 6)}`);
  }
}

function getSelectedStats(statConfig) {
  return TRAINABLE_STATS.filter(stat => Boolean(statConfig[stat]));
}

function sanitizeStatSelection(selection) {
  const fallback = createDefaultStatSelection();
  if (!selection || typeof selection !== "object") {
    return fallback;
  }

  const sanitized = {};
  for (const stat of TRAINABLE_STATS) {
    sanitized[stat] = Boolean(selection[stat]);
  }
  return sanitized;
}

function createDefaultStatSelection() {
  return {
    strength: true,
    defense: true,
    dexterity: true,
    agility: true,
    charisma: false,
  };
}

function stopCurrentAction(ns) {
  if (ns.singularity && typeof ns.singularity.stopAction === "function") {
    ns.singularity.stopAction();
  }
}

function resolveUniversityChoice(ns, trainerConfig, player = ns.getPlayer()) {
  return selectBestUniversity(
    ns,
    player,
    trainerConfig.charismaCourse,
    getConfiguredLocation(UNIVERSITY_LOCATIONS),
  );
}

function resolveGymChoice(ns, trainerConfig, player = ns.getPlayer(), stat = "strength") {
  return selectBestGym(
    ns,
    player,
    stat,
    getConfiguredLocation(GYM_LOCATIONS),
  );
}

function formatStatName(stat) {
  if (stat === "charisma") {
    return "CHA";
  }
  return stat.slice(0, 3).toUpperCase();
}

function padLeft(value, width) {
  return String(value).padStart(width, " ");
}