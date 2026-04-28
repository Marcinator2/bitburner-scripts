/** @param {NS} ns */

import { ensureJsonFile } from "./runtime_file_utils.js";

const DEFAULT_CONFIG_FILE = "main_manager_config.js";
const DEFAULT_LOOP_MS = 5000;

const SERVICE_DEFINITIONS = [
  {
    key: "hack",
    script: "auto-hack-manager.js",
    host: "home",
    threads: 1,
    enabled: true,
    args: [],
    description: "Central hacking manager",
    shouldRun: () => true,
  },
  {
    key: "hacknet",
    script: "manager_hacknet.js",
    host: "home",
    threads: 1,
    enabled: false,
    args: [],
    description: "Hacknet management",
    shouldRun: ns => Boolean(ns.hacknet && typeof ns.hacknet.numNodes === "function"),
  },
  {
    key: "stocks",
    script: "manager_stocks.js",
    host: "home",
    threads: 1,
    enabled: false,
    args: [],
    description: "Stock manager",
    shouldRun: ns => Boolean(
      ns.stock && (
        typeof ns.stock.buyStock === "function" ||
        typeof ns.stock.hasTixApiAccess === "function" ||
        typeof ns.stock.purchaseTixApi === "function"
      )
    ),
  },
  {
    key: "gang",
    script: "manager_gang.js",
    host: "home",
    threads: 1,
    enabled: false,
    args: [],
    description: "Gang manager",
    shouldRun: ns => Boolean(ns.gang && typeof ns.gang.inGang === "function" && ns.gang.inGang()),
  },
  {
    key: "negativeKarma",
    script: "manager_karma.js",
    host: "home",
    threads: 1,
    enabled: false,
    args: [DEFAULT_CONFIG_FILE],
    description: "Farms negative karma and trains until 90% crime chance",
    shouldRun: ns => Boolean(ns.singularity),
  },
  {
    key: "crime",
    script: "manager_crime.js",
    host: "home",
    threads: 1,
    enabled: false,
    args: [],
    description: "Commits best crime by $/s based on current stats",
    shouldRun: ns => Boolean(ns.singularity),
  },
  {
    key: "programs",
    script: "auto-leveler.js",
    host: "home",
    threads: 1,
    enabled: false,
    args: [],
    description: "Purchases programs automatically",
    shouldRun: ns => Boolean(ns.singularity),
  },
  {
    key: "combatTrainer",
    script: "combat_stat_trainer.js",
    host: "home",
    threads: 1,
    enabled: false,
    args: [DEFAULT_CONFIG_FILE, false, "Leadership"],
    description: "Trains selected stats continuously, including Charisma",
    shouldRun: ns => Boolean(ns.singularity),
  },
  {
    key: "playerStatsWorker",
    script: "player_stats_worker.js",
    host: "home",
    threads: 1,
    enabled: true,
    args: ["player_stats_data.txt", 10000, 360],
    description: "Collects player stat history",
    shouldRun: () => true,
  },
  {
    key: "playerStatsView",
    script: "player_stats.js",
    host: "home",
    threads: 1,
    enabled: true,
    args: ["player_stats_data.txt"],
    description: "Shows player stat dashboard",
    shouldRun: () => true,
  },
  {
    key: "overview",
    script: "overview.js",
    host: "home",
    threads: 1,
    enabled: true,
    args: [],
    description: "One-time overview, off by default",
    shouldRun: () => false,
  },
  {
    key: "augments",
    script: "manager_augments.js",
    host: "home",
    threads: 1,
    enabled: false,
    args: [DEFAULT_CONFIG_FILE],
    description: "Buys augmentations automatically (Hacking/Combat/Hacknet/Bladeburner/Charisma)",
    shouldRun: ns => Boolean(ns.singularity),
  },
  {
    key: "backdoor",
    script: "manager_backdoor.js",
    host: "home",
    threads: 1,
    enabled: false,
    args: [],
    description: "Installs backdoors on all reachable servers",
    shouldRun: ns => Boolean(ns.singularity),
  },
  {
    key: "ipvgo",
    script: "manager_ipvgo.js",
    host: "home",
    threads: 1,
    enabled: false,
    args: ["Slum Snakes", 7],
    description: "Plays IPvGO Subnet matches automatically",
    shouldRun: () => true,
  },
  {
    key: "corporation",
    script: "manager_corporation.js",
    host: "home",
    threads: 1,
    enabled: false,
    args: [DEFAULT_CONFIG_FILE],
    description: "Fully automated Corporation manager (divisions, products, invest rounds, public)",
    shouldRun: ns => Boolean(ns.corporation && typeof ns.corporation.hasCorporation === "function" && ns.corporation.hasCorporation()),
  },
  {
    key: "serverAdmin",
    script: "manager_server.js",
    host: "home",
    threads: 1,
    enabled: false,
    args: [],
    description: "Automated server buy/upgrade (reads autoBuy/autoUpgrade from config)",
    shouldRun: () => true,
  },
  {
    key: "bladeburner",
    script: "manager_bladeburner.js",
    host: "home",
    threads: 1,
    enabled: false,
    args: [],
    description: "Automated Bladeburner manager (stamina, chaos, actions, skills, Black Ops)",
    shouldRun: ns => Boolean(ns.bladeburner && typeof ns.bladeburner.inBladeburner === "function" && ns.bladeburner.inBladeburner()),
  },
];

export async function main(ns) {
  const mode = String(ns.args[0] || "watch").toLowerCase();
  const configFile = String(ns.args[1] || DEFAULT_CONFIG_FILE);

  ns.disableLog("sleep");
  ns.disableLog("exec");
  ns.disableLog("getServerUsedRam");
  ns.disableLog("getServerMaxRam");

  const initialConfig = loadConfig(ns, configFile);
  if (initialConfig.tail) {
    ns.tail();
  }

  if (mode === "once") {
    ns.clearLog();
    supervise(ns, configFile, true);
    return;
  }

  if (mode === "status") {
    ns.clearLog();
    const config = loadConfig(ns, configFile);
    printStatus(ns, inspectServices(ns, config), config, configFile);
    return;
  }

  while (true) {
    ns.clearLog();
    const config = supervise(ns, configFile, false);
    await ns.sleep(config.loopMs);
  }
}


function supervise(ns, configFile, runOnce) {
  const config = loadConfig(ns, configFile);
  const serviceStates = inspectServices(ns, config);

  for (const state of serviceStates) {
    if (!state.enabled) {
      if (state.running) {
        state.stopped = ns.scriptKill(state.script, state.host);
        state.running = scriptStillRunning(ns, state);
      }
      continue;
    }

    if (!state.canRun || state.running) {
      continue;
    }

    // Kill any stale instance running with different args (e.g. after an opponent/config change).
    // scriptKill is safe to call even if nothing is running — it just returns false.
    ns.scriptKill(state.script, state.host);

    const pid = ns.exec(state.script, state.host, state.threads, ...state.args);
    state.startedPid = pid;
    state.running = pid > 0;
    if (pid <= 0) {
      state.error = "Start failed";
    }
  }

  printStatus(ns, serviceStates, config, configFile);

  if (!runOnce) {
    ns.print("");
    ns.print(`Next check in ${Math.floor(config.loopMs / 1000)}s`);
  }

  return config;
}

function inspectServices(ns, config) {
  return SERVICE_DEFINITIONS.map(service => {
    const merged = mergeServiceConfig(service, config.services[service.key]);
    const scriptExists = ns.fileExists(merged.script, merged.host);
    const canRun = scriptExists && safeShouldRun(ns, merged);
    const running = scriptExists && ns.isRunning(merged.script, merged.host, ...merged.args);

    return {
      ...merged,
      scriptExists,
      canRun,
      running,
      startedPid: 0,
      stopped: false,
      error: scriptExists ? "" : "Script missing",
    };
  });
}

function scriptStillRunning(ns, state) {
  return ns.fileExists(state.script, state.host) && ns.isRunning(state.script, state.host, ...state.args);
}

function safeShouldRun(ns, service) {
  try {
    return service.shouldRun(ns);
  } catch {
    return false;
  }
}

function printStatus(ns, serviceStates, config, configFile) {
  ns.print("MAIN MANAGER");
  ns.print("");
  ns.print(`Config: ${configFile}`);
  ns.print(`Loop: ${Math.floor(config.loopMs / 1000)}s`);
  ns.print(`Home RAM: ${ns.formatRam(ns.getServerUsedRam("home"))} / ${ns.formatRam(ns.getServerMaxRam("home"))}`);
  ns.print("");

  for (const state of serviceStates) {
    ns.print(formatServiceLine(state));
    if (state.enabled) {
      const opts = formatServiceOptions(state.key, config.services[state.key] || {});
      if (opts) ns.print(`  └ ${opts}`);
    }
  }

  const guiState = config?.gui?.managerGui;
  if (guiState) {
    ns.print("");
    ns.print("SERVER ADMIN");
    ns.print(`  AutoBuy:    ${guiState.autoBuy    ? "ON" : "OFF"} (8 GB)`);
    ns.print(`  AutoUpgrade: ${guiState.autoUpgrade ? "ON" : "OFF"} (target: ${ns.formatRam(Number(guiState.upgradeRam) || 0)})`);
    ns.print(`  BuyRam:     ${ns.formatRam(Number(guiState.buyRam) || 0)}`);
  }
}

function formatServiceLine(state) {
  const name = padRight(state.key, 17);

  if (!state.enabled && state.stopped) {
    return `${name} STOPPED   ${state.script}`;
  }

  if (!state.enabled) {
    return `${name} DISABLED  ${state.script}`;
  }

  if (!state.scriptExists) {
    return `${name} MISSING   ${state.script}`;
  }

  if (!state.canRun) {
    return `${name} WAIT      ${state.description}`;
  }

  if (state.startedPid > 0) {
    return `${name} STARTED   pid ${state.startedPid}`;
  }

  if (state.running) {
    return `${name} RUNNING   ${state.script}`;
  }

  if (state.error) {
    return `${name} ERROR     ${state.error}`;
  }

  return `${name} IDLE      ${state.script}`;
}

function padRight(value, width) {
  return String(value).padEnd(width, " ");
}

function formatServiceOptions(key, cfg) {
  if (key === "combatTrainer") {
    const stats = cfg.stats || {};
    const LABELS = { strength: "STR", defense: "DEF", dexterity: "DEX", agility: "AGI", charisma: "CHA" };
    const active = Object.entries(stats).filter(([, v]) => v).map(([k]) => LABELS[k] || k).join("/");
    return active ? `Stats: ${active}` : "Stats: none";
  }
  if (key === "gang") {
    const flags = [];
    if (cfg.autoAscend)            flags.push("AutoAscend");
    if (cfg.autoEquipment)         flags.push("AutoEquip");
    if (cfg.autoTerritoryWarfare)  flags.push("Territory");
    if (cfg.prepCombatMode)        flags.push("PrepCombat");
    if (cfg.powerFarmMode)         flags.push("PowerFarm");
    if (cfg.respectFarmMode)       flags.push("RespectFarm");
    return flags.length ? flags.join(" | ") : "No flags set";
  }
  if (key === "augments") {
    const cats = cfg.categories || {};
    const CAT_LABELS = { hacking: "Hack", combat: "Combat", hacknet: "HN", bladeburner: "BB", charisma: "CHA" };
    const active = Object.entries(cats).filter(([, v]) => v).map(([k]) => CAT_LABELS[k] || k).join("/");
    const parts = [`Cats: ${active || "none"}`];
    if (cfg.repFarming) parts.push("RepFarm");
    if (cfg.repFarming && cfg.focus) parts.push("Focus");
    return parts.join(" | ");
  }
  if (key === "programs") {
    return `Build: ${cfg.build ? "ON" : "OFF"}`;
  }
  if (key === "ipvgo") {
    return `Opponent: ${cfg.opponent ?? "Slum Snakes"} | Board: ${cfg.boardSize ?? 7}`;
  }
  return null;
}

function loadConfig(ns, configFile) {
  const fallback = {
    loopMs: DEFAULT_LOOP_MS,
    tail: true,
    services: {},
    parseError: false,
  };

  const fileState = ensureJsonFile(ns, configFile, fallback);

  try {
    const parsed = fileState.value;
    return {
      loopMs: sanitizeLoopMs(parsed.loopMs),
      tail: parsed.tail !== false,
      services: parsed.services && typeof parsed.services === "object" ? parsed.services : {},
      gui: parsed.gui && typeof parsed.gui === "object" ? parsed.gui : {},
      parseError: fileState.repaired,
    };
  } catch {
    return {
      ...fallback,
      parseError: true,
    };
  }
}

function mergeServiceConfig(service, override = {}) {
  return {
    ...service,
    enabled: override.enabled ?? service.enabled,
    threads: sanitizeThreads(override.threads ?? service.threads),
    args: Array.isArray(override.args) ? override.args : service.args,
  };
}

function sanitizeLoopMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1000) {
    return DEFAULT_LOOP_MS;
  }
  return Math.floor(numeric);
}

function sanitizeThreads(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) {
    return 1;
  }
  return Math.floor(numeric);
}