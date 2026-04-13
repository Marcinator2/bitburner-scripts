/** @param {NS} ns */

import { ensureJsonFile } from "./runtime_file_utils.js";

const CONFIG_FILE = "main_manager_config.txt";
const PANEL_ID = "bitburner-main-manager-gui";
const REFRESH_MS = 1000;
const MAIN_MANAGER_SCRIPT = "main_manager.js";

const SERVICES = [
  { key: "hack", script: "auto-hack-manager.js", host: "home", label: "Hack" },
  { key: "hacknet", script: "manager_hacknet.js", host: "home", label: "Hacknet" },
  { key: "stocks", script: "manager_stocks.js", host: "home", label: "Stocks" },
  { key: "gang", script: "manager_gang.js", host: "home", label: "Gang" },
  { key: "programs", script: "auto-leveler.js", host: "home", label: "Programs" },
  { key: "combatTrainer", script: "combat_stat_trainer.js", host: "home", label: "Stat Trainer" },
  { key: "playerStatsWorker", script: "player_stats_worker.js", host: "home", label: "Stats Writer" },
  { key: "playerStatsView", script: "player_stats.js", host: "home", label: "Stats View" },
  { key: "overview", script: "overview.js", host: "home", label: "Overview" },
];

export async function main(ns) {
  ns.disableLog("ALL");

  const doc = getDocument();
  if (!doc) {
    ns.tprint("GUI nicht verfuegbar. Alternativ kann ich dir ein Prompt-Menue bauen.");
    return;
  }

  removeExistingPanel(doc);

  const panel = buildPanel(doc);
  doc.body.appendChild(panel.root);
  doc.body.appendChild(panel.launcher);
  const actionQueue = [];
  const cleanup = enableWindowBehavior(doc, panel);

  if (typeof ns.atExit === "function") {
    ns.atExit(() => {
      cleanup();
      removeExistingPanel(doc);
    });
  }

  wireActions(panel, actionQueue);

  while (true) {
    processQueuedActions(ns, actionQueue);
    renderPanel(ns, panel);
    await ns.sleep(REFRESH_MS);
  }
}

function getDocument() {
  try {
    return eval("document");
  } catch {
    return null;
  }
}

function removeExistingPanel(doc) {
  const existing = doc.getElementById(PANEL_ID);
  if (existing) {
    existing.remove();
  }

  const launcher = doc.getElementById(`${PANEL_ID}-launcher`);
  if (launcher) {
    launcher.remove();
  }
}

function buildPanel(doc) {
  const root = doc.createElement("div");
  root.id = PANEL_ID;
  root.style.position = "fixed";
  root.style.top = "96px";
  root.style.right = "24px";
  root.style.width = "340px";
  root.style.maxHeight = "80vh";
  root.style.overflowY = "auto";
  root.style.zIndex = "10000";
  root.style.background = "linear-gradient(180deg, rgba(17,24,39,0.96), rgba(5,10,20,0.96))";
  root.style.color = "#e5eef7";
  root.style.border = "1px solid rgba(120,190,255,0.25)";
  root.style.borderRadius = "14px";
  root.style.boxShadow = "0 12px 40px rgba(0,0,0,0.45)";
  root.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  root.style.backdropFilter = "blur(8px)";

  const header = doc.createElement("div");
  header.style.padding = "14px 16px 10px";
  header.style.borderBottom = "1px solid rgba(120,190,255,0.18)";
  header.style.display = "flex";
  header.style.alignItems = "flex-start";
  header.style.justifyContent = "space-between";
  header.style.gap = "12px";
  header.style.cursor = "move";
  header.style.position = "sticky";
  header.style.top = "0";
  header.style.zIndex = "2";
  header.style.background = "linear-gradient(180deg, rgba(17,24,39,0.98), rgba(10,16,28,0.96))";
  header.style.backdropFilter = "blur(8px)";

  const titleWrap = doc.createElement("div");
  const title = doc.createElement("div");
  title.textContent = "Main Manager";
  title.style.fontSize = "18px";
  title.style.fontWeight = "700";
  title.style.letterSpacing = "0.04em";

  const subtitle = doc.createElement("div");
  subtitle.textContent = CONFIG_FILE;
  subtitle.style.marginTop = "4px";
  subtitle.style.fontSize = "12px";
  subtitle.style.color = "#8db3d9";

  titleWrap.append(title, subtitle);

  const headerActions = doc.createElement("div");
  headerActions.style.display = "flex";
  headerActions.style.gap = "8px";

  const minimizeButton = makeButton(doc, "Hide", "toggle-visibility");
  minimizeButton.style.padding = "6px 9px";
  minimizeButton.style.fontSize = "11px";
  minimizeButton.dataset.dragHandle = "ignore";
  styleActionButton(minimizeButton, "neutral");
  headerActions.append(minimizeButton);

  header.append(titleWrap, headerActions);

  const topBar = doc.createElement("div");
  topBar.style.display = "flex";
  topBar.style.gap = "8px";
  topBar.style.padding = "12px 16px 0";

  const startButton = makeButton(doc, "Start Manager", "start-manager");
  const stopButton = makeButton(doc, "Stop Manager", "stop-manager");
  const refreshButton = makeButton(doc, "Refresh", "refresh");
  startButton.style.flex = "1";
  stopButton.style.flex = "1";
  refreshButton.style.flex = "0 0 auto";
  topBar.append(startButton, stopButton, refreshButton);

  const meta = doc.createElement("div");
  meta.style.padding = "12px 16px";
  meta.style.fontSize = "12px";
  meta.style.color = "#9fc0de";

  const status = doc.createElement("div");
  const loop = doc.createElement("div");
  meta.append(status, loop);

  const list = doc.createElement("div");
  list.style.padding = "0 12px 12px";
  list.style.display = "grid";
  list.style.gap = "10px";

  const content = doc.createElement("div");
  content.append(topBar, meta, list);

  const rows = new Map();
  for (const service of SERVICES) {
    const row = doc.createElement("div");
    row.style.padding = "10px 12px";
    row.style.border = "1px solid rgba(255,255,255,0.08)";
    row.style.borderRadius = "10px";
    row.style.background = "rgba(255,255,255,0.03)";

    const top = doc.createElement("div");
    top.style.display = "flex";
    top.style.alignItems = "center";
    top.style.justifyContent = "space-between";
    top.style.gap = "10px";

    const labelWrap = doc.createElement("div");
    const label = doc.createElement("div");
    label.textContent = service.label;
    label.style.fontSize = "14px";
    label.style.fontWeight = "700";

    const script = doc.createElement("div");
    script.textContent = service.script;
    script.style.fontSize = "11px";
    script.style.color = "#7fa6c8";
    script.style.marginTop = "3px";
    labelWrap.append(label, script);

    const toggle = makeButton(doc, "", `toggle:${service.key}`);
    toggle.style.minWidth = "88px";
    top.append(labelWrap, toggle);

    const details = doc.createElement("div");
    details.style.marginTop = "8px";
    details.style.fontSize = "11px";
    details.style.color = "#b9d1e7";

    let statControls = null;
    if (service.key === "combatTrainer") {
      statControls = buildCombatStatControls(doc);
      row.append(top, details, statControls.wrap);
    } else {
      row.append(top, details);
    }

    list.appendChild(row);
    rows.set(service.key, { toggle, details, row, statControls });
  }

  const launcher = makeButton(doc, "Manager GUI", "toggle-visibility");
  launcher.id = `${PANEL_ID}-launcher`;
  launcher.style.position = "fixed";
  launcher.style.right = "24px";
  launcher.style.top = "96px";
  launcher.style.zIndex = "10001";
  launcher.style.display = "none";
  launcher.style.padding = "10px 12px";
  launcher.style.borderRadius = "999px";
  launcher.style.boxShadow = "0 8px 24px rgba(0,0,0,0.35)";
  styleActionButton(launcher, "neutral");

  root.append(header, content);

  return {
    root,
    launcher,
    header,
    content,
    status,
    loop,
    startButton,
    stopButton,
    refreshButton,
    minimizeButton,
    rows,
  };
}

function makeButton(doc, text, action) {
  const button = doc.createElement("button");
  button.textContent = text;
  button.dataset.action = action;
  button.style.border = "1px solid rgba(120,190,255,0.28)";
  button.style.background = "rgba(43,100,164,0.22)";
  button.style.color = "#eef6ff";
  button.style.borderRadius = "8px";
  button.style.padding = "8px 10px";
  button.style.cursor = "pointer";
  button.style.font = "inherit";
  return button;
}

function buildCombatStatControls(doc) {
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

  return { wrap, checkboxes };
}

function formatCombatStatLabel(stat) {
  if (stat === "strength") return "STR";
  if (stat === "defense") return "DEF";
  if (stat === "dexterity") return "DEX";
  if (stat === "charisma") return "CHA";
  return "AGI";
}

function wireActions(panel, actionQueue) {
  panel.root.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (button) {
      const action = button.dataset.action || "";
      actionQueue.push(action);
    }
  });

  panel.root.addEventListener("change", event => {
    const input = event.target.closest("input[data-action]");
    if (!input) {
      return;
    }

    actionQueue.push(input.dataset.action || "");
  });

  panel.launcher.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    actionQueue.push(button.dataset.action || "");
  });
}

function processQueuedActions(ns, actionQueue) {
  while (actionQueue.length > 0) {
    const action = actionQueue.shift();

    if (action === "start-manager") {
      startMainManager(ns);
      continue;
    }

    if (action === "stop-manager") {
      ns.scriptKill(MAIN_MANAGER_SCRIPT, "home");
      continue;
    }

    if (action === "refresh") {
      continue;
    }

    if (action === "toggle-visibility") {
      continue;
    }

    if (action.startsWith("toggle-combat-stat:")) {
      const stat = action.split(":")[1];
      toggleCombatTrainerStat(ns, stat);
      continue;
    }

    if (action.startsWith("toggle:")) {
      const key = action.split(":")[1];
      toggleService(ns, key);
    }
  }
}

function enableWindowBehavior(doc, panel) {
  const state = {
    dragging: false,
    offsetX: 0,
    offsetY: 0,
    hidden: false,
  };

  const syncLauncherPosition = () => {
    panel.launcher.style.left = "";
    panel.launcher.style.right = "24px";
    panel.launcher.style.top = panel.root.style.top || "96px";
  };

  const setHidden = hidden => {
    state.hidden = hidden;
    panel.root.style.display = hidden ? "none" : "block";
    panel.launcher.style.display = hidden ? "block" : "none";
    if (hidden) {
      syncLauncherPosition();
    }
  };

  const onMouseDown = event => {
    if (event.button !== 0) {
      return;
    }

    if (event.target.closest("button[data-action]")) {
      return;
    }

    const rect = panel.root.getBoundingClientRect();
    state.dragging = true;
    state.offsetX = event.clientX - rect.left;
    state.offsetY = event.clientY - rect.top;
    doc.body.style.userSelect = "none";
  };

  const onMouseMove = event => {
    if (!state.dragging) {
      return;
    }

    const maxLeft = Math.max(0, window.innerWidth - panel.root.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - 48);
    const left = clamp(event.clientX - state.offsetX, 0, maxLeft);
    const top = clamp(event.clientY - state.offsetY, 0, maxTop);

    panel.root.style.left = `${left}px`;
    panel.root.style.right = "auto";
    panel.root.style.top = `${top}px`;

    if (state.hidden) {
      syncLauncherPosition();
    }
  };

  const onMouseUp = () => {
    state.dragging = false;
    doc.body.style.userSelect = "";
  };

  const onToggleVisibility = event => {
    const button = event.target.closest("button[data-action='toggle-visibility']");
    if (!button) {
      return;
    }

    setHidden(!state.hidden);
  };

  panel.header.addEventListener("mousedown", onMouseDown);
  doc.addEventListener("mousemove", onMouseMove);
  doc.addEventListener("mouseup", onMouseUp);
  panel.root.addEventListener("click", onToggleVisibility);
  panel.launcher.addEventListener("click", onToggleVisibility);
  syncLauncherPosition();

  return () => {
    panel.header.removeEventListener("mousedown", onMouseDown);
    doc.removeEventListener("mousemove", onMouseMove);
    doc.removeEventListener("mouseup", onMouseUp);
    panel.root.removeEventListener("click", onToggleVisibility);
    panel.launcher.removeEventListener("click", onToggleVisibility);
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function renderPanel(ns, panel) {
  const config = loadConfig(ns, CONFIG_FILE);
  const managerRunning = ns.scriptRunning(MAIN_MANAGER_SCRIPT, "home");

  panel.status.textContent = `Main Manager: ${managerRunning ? "RUNNING" : "STOPPED"}`;
  panel.loop.textContent = `Loop: ${Math.floor(config.loopMs / 1000)}s`;
  panel.startButton.disabled = managerRunning;
  panel.stopButton.disabled = !managerRunning;
  styleActionButton(panel.startButton, managerRunning ? "disabled" : "start");
  styleActionButton(panel.stopButton, managerRunning ? "stop" : "disabled");
  styleActionButton(panel.refreshButton, "neutral");

  for (const service of SERVICES) {
    const row = panel.rows.get(service.key);
    if (!row) {
      continue;
    }

    const override = config.services[service.key] || {};
    const enabled = override.enabled ?? false;
    const running = ns.scriptRunning(service.script, service.host);
    const scriptExists = ns.fileExists(service.script, service.host);

    row.toggle.textContent = enabled ? "Disable" : "Enable";
    styleActionButton(row.toggle, enabled ? "stop" : "start");
    row.details.textContent = [
      `Config: ${enabled ? "ON" : "OFF"}`,
      `Runtime: ${running ? "RUNNING" : "STOPPED"}`,
      `Threads: ${override.threads ?? 1}`,
      scriptExists ? "Script: OK" : "Script: MISSING",
    ].join(" | ");
    row.row.style.borderColor = enabled ? "rgba(86,201,120,0.35)" : "rgba(255,255,255,0.08)";

    if (service.key === "combatTrainer" && row.statControls) {
      const stats = sanitizeCombatStatSelection(override.stats);
      for (const [stat, checkbox] of row.statControls.checkboxes.entries()) {
        checkbox.checked = Boolean(stats[stat]);
      }
    }
  }
}

function styleActionButton(button, mode) {
  if (mode === "start") {
    button.style.background = "rgba(53,133,74,0.32)";
    button.style.borderColor = "rgba(95,220,129,0.45)";
    button.style.opacity = "1";
    return;
  }

  if (mode === "stop") {
    button.style.background = "rgba(150,51,71,0.32)";
    button.style.borderColor = "rgba(255,126,153,0.45)";
    button.style.opacity = "1";
    return;
  }

  if (mode === "disabled") {
    button.style.background = "rgba(120,130,145,0.12)";
    button.style.borderColor = "rgba(180,190,205,0.18)";
    button.style.opacity = "0.55";
    return;
  }

  button.style.background = "rgba(43,100,164,0.22)";
  button.style.borderColor = "rgba(120,190,255,0.28)";
  button.style.opacity = "1";
}

function toggleService(ns, key) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services[key] || {};
  const service = SERVICES.find(entry => entry.key === key);
  if (!service) {
    return;
  }

  const enabled = !(current.enabled ?? false);
  config.services[key] = {
    ...current,
    enabled,
  };
  saveConfig(ns, CONFIG_FILE, config);

  if (!enabled) {
    ns.scriptKill(service.script, service.host);
    return;
  }

  startMainManager(ns);
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
    args: Array.isArray(current.args) ? current.args : [CONFIG_FILE, "Sector-12", "Powerhouse Gym", false, "Sector-12", "Rothman University", "Leadership"],
    stats,
  };

  saveConfig(ns, CONFIG_FILE, config);
}

function sanitizeCombatStatSelection(selection) {
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

function startMainManager(ns) {
  if (!ns.scriptRunning(MAIN_MANAGER_SCRIPT, "home")) {
    ns.exec(MAIN_MANAGER_SCRIPT, "home", 1);
  }
}

function loadConfig(ns, configFile) {
  const fallback = {
    loopMs: 5000,
    tail: true,
    services: {},
  };

  const fileState = ensureJsonFile(ns, configFile, fallback);

  try {
    const parsed = fileState.value;
    return {
      loopMs: Number(parsed.loopMs) || fallback.loopMs,
      tail: parsed.tail !== false,
      services: parsed.services && typeof parsed.services === "object" ? parsed.services : {},
    };
  } catch {
    return fallback;
  }
}

function saveConfig(ns, configFile, config) {
  ns.write(configFile, JSON.stringify(config, null, 2), "w");
}