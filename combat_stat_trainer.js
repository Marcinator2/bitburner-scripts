/** @param {NS} ns */

const DEFAULT_CITY = "Sector-12";
const DEFAULT_GYM = "Powerhouse Gym";
const CHECK_INTERVAL_MS = 15000;
const COMBAT_STATS = ["strength", "defense", "dexterity", "agility"];

export async function main(ns) {
  if (!ns.singularity || typeof ns.singularity.gymWorkout !== "function") {
    ns.tprint("Fehler: Singularity API nicht verfuegbar. Benoetigt Source-File 4.");
    return;
  }

  const config = parseArgs(ns);
  if (!config) {
    printUsage(ns);
    return;
  }

  ns.disableLog("sleep");
  ns.tail();

  if (!ensureCity(ns, config.city)) {
    ns.tprint(`Fehler: Konnte nicht nach ${config.city} reisen.`);
    return;
  }

  while (true) {
    ns.clearLog();

    const playerSkills = ns.getPlayer().skills;
    const nextStat = pickNextStat(playerSkills, config.targets);

    printStatus(ns, playerSkills, config.targets, config.city, config.gym);

    if (!nextStat) {
      stopCurrentAction(ns);
      ns.tprint("Combat-Ziele erreicht.");
      return;
    }

    const started = ns.singularity.gymWorkout(config.gym, nextStat, config.focus);
    if (!started) {
      ns.tprint(`Fehler: Training in ${config.gym} fuer ${nextStat} konnte nicht gestartet werden.`);
      return;
    }

    ns.print("");
    ns.print(`Trainiere jetzt: ${nextStat.toUpperCase()}`);
    await ns.sleep(CHECK_INTERVAL_MS);
  }
}

function parseArgs(ns) {
  const args = ns.args;
  if (args.length < 4) {
    return null;
  }

  const targets = {
    strength: Number(args[0]),
    defense: Number(args[1]),
    dexterity: Number(args[2]),
    agility: Number(args[3]),
  };

  if (Object.values(targets).some(value => !Number.isFinite(value) || value < 1)) {
    return null;
  }

  return {
    targets,
    city: String(args[4] || DEFAULT_CITY),
    gym: String(args[5] || DEFAULT_GYM),
    focus: Boolean(args[6]),
  };
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

function pickNextStat(skills, targets) {
  let nextStat = "";
  let biggestGap = 0;

  for (const stat of COMBAT_STATS) {
    const gap = targets[stat] - skills[stat];
    if (gap > biggestGap) {
      biggestGap = gap;
      nextStat = stat;
    }
  }

  return nextStat;
}

function printStatus(ns, skills, targets, city, gym) {
  ns.print("COMBAT TRAINER");
  ns.print("");
  ns.print(`Ort: ${city} | Gym: ${gym}`);
  ns.print("");

  for (const stat of COMBAT_STATS) {
    const current = skills[stat];
    const target = targets[stat];
    const remaining = Math.max(0, target - current);
    ns.print(`${formatStatName(stat)} ${padLeft(current, 6)} / ${padLeft(target, 6)} | Rest ${padLeft(remaining, 6)}`);
  }
}

function stopCurrentAction(ns) {
  if (ns.singularity && typeof ns.singularity.stopAction === "function") {
    ns.singularity.stopAction();
  }
}

function formatStatName(stat) {
  return stat.slice(0, 3).toUpperCase();
}

function padLeft(value, width) {
  return String(value).padStart(width, " ");
}

function printUsage(ns) {
  ns.tprint("Usage: run combat_stat_trainer.js [str] [def] [dex] [agi] [city?] [gym?] [focus?]");
  ns.tprint("Beispiel: run combat_stat_trainer.js 100 100 100 100 Sector-12 \"Powerhouse Gym\" true");
}