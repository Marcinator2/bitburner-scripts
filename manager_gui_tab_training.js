import { loadConfig, saveConfig, CONFIG_FILE } from "./manager_gui_utils.js";
import { getBestKarmaCrime } from "./manager_karma.js";
import { normalizeUniversityCourse } from "./training_location_utils.js";

// --- DOM builder ---

export function buildCombatStatControls(doc) {
  const wrap = doc.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
  wrap.style.gap = "6px 10px";
  wrap.style.marginTop = "10px";
  wrap.style.fontSize = "11px";
  wrap.style.color = "#c6d8eb";

  const checkboxes = new Map();
  for (const stat of ["strength", "defense", "dexterity", "agility", "charisma"]) {
    const label = doc.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "6px";
    label.style.cursor = "pointer";

    const checkbox = doc.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.action = `toggle-combat-stat:${stat}`;
    checkbox.style.cursor = "pointer";

    const text = doc.createElement("span");
    text.textContent = formatCombatStatLabel(stat);

    label.append(checkbox, text);
    wrap.appendChild(label);
    checkboxes.set(stat, checkbox);
  }

  const divider = doc.createElement("div");
  divider.style.gridColumn = "1 / -1";
  divider.style.borderTop = "1px solid rgba(255,255,255,0.10)";
  divider.style.marginTop = "4px";
  wrap.appendChild(divider);

  const focusLabel = doc.createElement("label");
  focusLabel.style.display = "flex";
  focusLabel.style.alignItems = "center";
  focusLabel.style.gap = "6px";
  focusLabel.style.cursor = "pointer";
  focusLabel.style.gridColumn = "1 / -1";

  const focusCheckbox = doc.createElement("input");
  focusCheckbox.type = "checkbox";
  focusCheckbox.dataset.action = "toggle-combat-focus";
  focusCheckbox.style.cursor = "pointer";

  const focusText = doc.createElement("span");
  focusText.textContent = "Train with Focus";

  focusLabel.append(focusCheckbox, focusText);
  wrap.appendChild(focusLabel);

  return { wrap, checkboxes, focusCheckbox };
}

// --- Config getters ---

export function getCombatTrainerConfig(service) {
  const args = Array.isArray(service.args) ? service.args : [];
  const usesLegacyArgs = args.length >= 7;
  return {
    enabled: service.enabled ?? false,
    focus: usesLegacyArgs ? Boolean(args[3]) : Boolean(args[1]),
    charismaCourse: normalizeUniversityCourse((usesLegacyArgs ? args[6] : args[2]) || "Leadership"),
    stats: sanitizeCombatStatSelection(service.stats),
  };
}

export function sanitizeCombatStatSelection(selection) {
  const fallback = {
    strength: true,
    defense: true,
    dexterity: true,
    agility: true,
    charisma: false,
  };

  if (!selection || typeof selection !== "object") {
    return fallback;
  }

  return {
    strength: Boolean(selection.strength),
    defense: Boolean(selection.defense),
    dexterity: Boolean(selection.dexterity),
    agility: Boolean(selection.agility),
    charisma: Boolean(selection.charisma),
  };
}

export function getNegativeKarmaConfig(service) {
  return {
    trainerManaged: service.trainerManaged === true,
  };
}

// --- Details builders ---

export function buildCombatTrainerDetails(enabled, running, override, scriptExists, trainerConfig) {
  const activeStats = Object.entries(trainerConfig.stats)
    .filter(([, selected]) => selected)
    .map(([stat]) => formatCombatStatLabel(stat))
    .join(", ");

  return [
    `Config: ${enabled ? "ON" : "OFF"} | Runtime: ${running ? "RUNNING" : "STOPPED"} | Threads: ${override.threads ?? 1} | ${scriptExists ? "Script: OK" : "Script: MISSING"}`,
    `Stats: ${activeStats || "none"} | Focus: ${trainerConfig.focus ? "ON" : "OFF"}`,
    `Combat: Auto best gym (XP/s)`,
    `Charisma: Auto best university (XP/s) / ${trainerConfig.charismaCourse}`,
  ].join("\n");
}

export function buildNegativeKarmaDetails(ns, enabled, running, override, scriptExists, negativeKarmaConfig, combatTrainerConfig) {
  const bestCrime = getNegativeKarmaCrimeForDisplay(ns);
  const currentWork = typeof ns.singularity?.getCurrentWork === "function"
    ? ns.singularity.getCurrentWork()
    : null;
  const trainerStats = Object.entries(combatTrainerConfig.stats)
    .filter(([, selected]) => selected)
    .map(([stat]) => formatCombatStatLabel(stat))
    .join(", ");

  if (!bestCrime) {
    return [
      `Config: ${enabled ? "ON" : "OFF"} | Runtime: ${running ? "RUNNING" : "STOPPED"} | Threads: ${override.threads ?? 1} | ${scriptExists ? "Script: OK" : "Script: MISSING"}`,
      "Crime: not available",
      "Chance/Karma: n/a",
    ].join("\n");
  }

  const mode = negativeKarmaConfig.trainerManaged && combatTrainerConfigEnabled(combatTrainerConfig, currentWork)
    ? "Training for 90%"
    : isCrimeWork(currentWork, bestCrime.type)
      ? "Crime active"
      : "Ready";

  return [
    `Config: ${enabled ? "ON" : "OFF"} | Runtime: ${running ? "RUNNING" : "STOPPED"} | Threads: ${override.threads ?? 1} | ${scriptExists ? "Script: OK" : "Script: MISSING"}`,
    `Crime: ${bestCrime.type} | Chance: ${(bestCrime.chance * 100).toFixed(1)}% | Karma/s: ${bestCrime.karmaPerSecond.toFixed(3)}`,
    `Mode: ${mode} | Target chance: 90.0%`,
    `Trainer Stats: ${trainerStats || "none"}`,
  ].join("\n");
}

// --- Controls sync ---

export function syncCombatTrainerControls(row, override, combatTrainerConfig) {
  if (!row.statControls) return;
  const stats = sanitizeCombatStatSelection(override.stats);
  for (const [stat, checkbox] of row.statControls.checkboxes.entries()) {
    checkbox.checked = Boolean(stats[stat]);
  }
  if (row.statControls.focusCheckbox) {
    row.statControls.focusCheckbox.checked = combatTrainerConfig.focus;
  }
}

// --- Action handler ---

export function handleTrainingAction(ns, action) {
  if (action.startsWith("toggle-combat-stat:")) {
    const stat = action.split(":")[1];
    toggleCombatTrainerStat(ns, stat);
    return true;
  }

  if (action === "toggle-combat-focus") {
    toggleCombatTrainerFocus(ns);
    return true;
  }

  return false;
}

// --- Private helpers ---

function formatCombatStatLabel(stat) {
  if (stat === "strength") return "STR";
  if (stat === "defense") return "DEF";
  if (stat === "dexterity") return "DEX";
  if (stat === "charisma") return "CHA";
  return "AGI";
}

function getNegativeKarmaCrimeForDisplay(ns) {
  if (!ns.singularity || typeof ns.singularity.getCrimeStats !== "function" || typeof ns.singularity.getCrimeChance !== "function") {
    return null;
  }

  try {
    return getBestKarmaCrime(ns);
  } catch {
    return null;
  }
}

function combatTrainerConfigEnabled(trainerConfig, currentWork) {
  if (trainerConfig.enabled) {
    return true;
  }

  return Boolean(currentWork && String(currentWork.type || "").toLowerCase() === "class");
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

function toggleCombatTrainerStat(ns, stat) {
  if (!["strength", "defense", "dexterity", "agility", "charisma"].includes(stat)) {
    return;
  }

  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.combatTrainer || {};
  const stats = sanitizeCombatStatSelection(current.stats);
  stats[stat] = !stats[stat];

  config.services.combatTrainer = {
    ...current,
    enabled: current.enabled ?? false,
    threads: current.threads ?? 1,
    args: Array.isArray(current.args) ? current.args : [CONFIG_FILE, false, "Leadership"],
    stats,
  };

  saveConfig(ns, CONFIG_FILE, config);
}

function toggleCombatTrainerFocus(ns) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.combatTrainer || {};
  const trainerConfig = getCombatTrainerConfig(current);

  const args = Array.isArray(current.args) ? [...current.args] : [CONFIG_FILE, false, "Leadership"];
  const usesLegacyArgs = args.length >= 7;
  const focusIdx = usesLegacyArgs ? 3 : 1;
  args[focusIdx] = !trainerConfig.focus;

  config.services.combatTrainer = {
    ...current,
    enabled: current.enabled ?? false,
    threads: current.threads ?? 1,
    args,
    stats: sanitizeCombatStatSelection(current.stats),
  };

  saveConfig(ns, CONFIG_FILE, config);
}
