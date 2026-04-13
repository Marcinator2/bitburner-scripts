/** @param {NS} ns */

import { ensureJsonFile } from "./runtime_file_utils.js";

const DEFAULT_CONFIG_FILE = "main_manager_config.txt";
const DEFAULT_CITY = "Sector-12";
const DEFAULT_GYM = "Powerhouse Gym";
const DEFAULT_UNIVERSITY = "Rothman University";
const DEFAULT_CHARISMA_COURSE = "Leadership";
const CHECK_INTERVAL_MS = 15000;
const TRAINABLE_STATS = ["strength", "defense", "dexterity", "agility", "charisma"];
const SERVICE_KEY = "combatTrainer";

export async function main(ns) {
  if (!ns.singularity) {
    ns.tprint("Fehler: Singularity API nicht verfuegbar. Benoetigt Source-File 4.");
    return;
  }

  const configFile = String(ns.args[0] || DEFAULT_CONFIG_FILE);

  ns.disableLog("sleep");
  ns.tail();

  let currentStat = "";

  while (true) {
    ns.clearLog();

    const trainerConfig = loadTrainerConfig(ns, configFile);
    const playerSkills = ns.getPlayer().skills;
    const selectedStats = getSelectedStats(trainerConfig.stats);
    const nextStat = pickNextStat(playerSkills, selectedStats);

    printStatus(ns, playerSkills, trainerConfig, selectedStats, currentStat);

    if (!nextStat) {
      if (currentStat) {
        stopCurrentAction(ns);
        currentStat = "";
      }

      ns.print("");
      ns.print("Keine Combat-Stats ausgewaehlt. Warte auf Aenderung...");
      await ns.sleep(CHECK_INTERVAL_MS);
      continue;
    }

    if (currentStat !== nextStat) {
      const started = startTraining(ns, trainerConfig, nextStat);
      if (!started) {
        ns.print(`Fehler: Training fuer ${nextStat} konnte nicht gestartet werden.`);
        await ns.sleep(CHECK_INTERVAL_MS);
        continue;
      }

      currentStat = nextStat;
    }

    ns.print("");
    ns.print(`Trainiere jetzt: ${currentStat.toUpperCase()}`);
    await ns.sleep(CHECK_INTERVAL_MS);
  }
}

function loadTrainerConfig(ns, configFile) {
  const fallback = {
    combatCity: DEFAULT_CITY,
    gym: DEFAULT_GYM,
    charismaCity: DEFAULT_CITY,
    university: DEFAULT_UNIVERSITY,
    charismaCourse: DEFAULT_CHARISMA_COURSE,
    focus: false,
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
          args: [DEFAULT_CONFIG_FILE, DEFAULT_CITY, DEFAULT_GYM, false, DEFAULT_CITY, DEFAULT_UNIVERSITY, DEFAULT_CHARISMA_COURSE],
          stats: createDefaultStatSelection(),
        },
      },
    });
    const parsed = fileState.value;
    const service = parsed?.services?.[SERVICE_KEY] || {};
    const args = Array.isArray(service.args) ? service.args : [];
    return {
      combatCity: String(args[1] || DEFAULT_CITY),
      gym: String(args[2] || DEFAULT_GYM),
      focus: Boolean(args[3]),
      charismaCity: String(args[4] || args[1] || DEFAULT_CITY),
      university: String(args[5] || DEFAULT_UNIVERSITY),
      charismaCourse: String(args[6] || DEFAULT_CHARISMA_COURSE),
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

function startTraining(ns, trainerConfig, stat) {
  if (stat === "charisma") {
    if (typeof ns.singularity.universityCourse !== "function") {
      return false;
    }

    if (!ensureCity(ns, trainerConfig.charismaCity)) {
      return false;
    }

    return ns.singularity.universityCourse(
      trainerConfig.university,
      trainerConfig.charismaCourse,
      trainerConfig.focus,
    );
  }

  if (typeof ns.singularity.gymWorkout !== "function") {
    return false;
  }

  if (!ensureCity(ns, trainerConfig.combatCity)) {
    return false;
  }

  return ns.singularity.gymWorkout(trainerConfig.gym, stat, trainerConfig.focus);
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

function printStatus(ns, skills, trainerConfig, selectedStats, currentStat) {
  ns.print("STAT TRAINER");
  ns.print("");
  ns.print(`Config: ${DEFAULT_CONFIG_FILE}`);
  ns.print(`Combat: ${trainerConfig.combatCity} | Gym: ${trainerConfig.gym}`);
  ns.print(`Charisma: ${trainerConfig.charismaCity} | Uni: ${trainerConfig.university}`);
  ns.print(`Kurs: ${trainerConfig.charismaCourse}`);
  ns.print(`Focus: ${trainerConfig.focus ? "ON" : "OFF"}`);
  ns.print("");
  ns.print(`Aktive Stats: ${selectedStats.length > 0 ? selectedStats.map(formatStatName).join(", ") : "keine"}`);
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

function formatStatName(stat) {
  if (stat === "charisma") {
    return "CHA";
  }
  return stat.slice(0, 3).toUpperCase();
}

function padLeft(value, width) {
  return String(value).padStart(width, " ");
}