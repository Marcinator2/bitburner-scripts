/** @param {NS} ns */

import { ensureJsonFile } from "./runtime_file_utils.js";
import { getBestKarmaCrime } from "./manager_karma.js";
import { normalizeUniversityCourse } from "./training_location_utils.js";

const CONFIG_FILE = "main_manager_config.txt";
const PANEL_ID = "bitburner-main-manager-gui";
const REFRESH_MS = 1000;
const MAIN_MANAGER_SCRIPT = "main_manager.js";
const NEW_SERVER_BUY_SCRIPT = "new_server_buy.js";
const UPGRADE_SERVER_SCRIPT = "upgrade_Server.js";
const BUY_RAM_DEFAULT = 2 ** 16;
const UPGRADE_RAM_DEFAULT = 2 ** 12;
const RAM_OPTIONS = [8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576];
const GUI_STATE_DEFAULT = {
  buyRam: BUY_RAM_DEFAULT,
  upgradeRam: UPGRADE_RAM_DEFAULT,
  panel: {
    top: "96px",
    left: "",
    right: "24px",
    hidden: false,
  },
};

const SERVICES = [
  { key: "hack", script: "auto-hack-manager.js", host: "home", label: "Hack" },
  { key: "hacknet", script: "manager_hacknet.js", host: "home", label: "Hacknet" },
  { key: "stocks", script: "manager_stocks.js", host: "home", label: "Stocks" },
  { key: "gang", script: "manager_gang.js", host: "home", label: "Gang" },
  { key: "negativeKarma", script: "manager_karma.js", host: "home", label: "Negative Karma" },
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

  const initialConfig = loadConfig(ns, CONFIG_FILE);
  const panel = buildPanel(doc);
  doc.body.appendChild(panel.root);
  doc.body.appendChild(panel.launcher);
  const actionQueue = [];
  applySavedGuiState(panel, initialConfig);
  const cleanup = enableWindowBehavior(doc, panel, actionQueue, initialConfig);

  if (typeof ns.atExit === "function") {
    ns.atExit(() => {
      cleanup();
      removeExistingPanel(doc);
    });
  }

  wireActions(panel, actionQueue);

  while (true) {
    processQueuedActions(ns, panel, actionQueue);
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

  const admin = buildServerAdminSection(doc);

  const content = doc.createElement("div");
  content.append(topBar, meta, admin.wrap, list);

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
    let gangControls = null;
    if (service.key === "combatTrainer") {
      statControls = buildCombatStatControls(doc);
      row.append(top, details, statControls.wrap);
    } else if (service.key === "gang") {
      gangControls = buildGangControls(doc);
      row.append(top, details, gangControls.wrap);
    } else {
      row.append(top, details);
    }

    list.appendChild(row);
    rows.set(service.key, { toggle, details, row, statControls, gangControls });
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
    admin,
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

  // Trennlinie
  const divider = doc.createElement("div");
  divider.style.gridColumn = "1 / -1";
  divider.style.borderTop = "1px solid rgba(255,255,255,0.10)";
  divider.style.marginTop = "4px";
  wrap.appendChild(divider);

  // Focus-Checkbox
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
  focusText.textContent = "Training mit Focus";

  focusLabel.append(focusCheckbox, focusText);
  wrap.appendChild(focusLabel);

  return { wrap, checkboxes, focusCheckbox };
}

function buildGangControls(doc) {
  const wrap = doc.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gridTemplateColumns = "minmax(0, 1fr)";
  wrap.style.gap = "6px";
  wrap.style.marginTop = "10px";
  wrap.style.fontSize = "11px";
  wrap.style.color = "#c6d8eb";

  const checkboxes = new Map();
  const options = [
    { key: "autoAscend", action: "toggle-gang-auto-ascend", label: "Mitglieder automatisch aufleveln" },
    { key: "autoEquipment", action: "toggle-gang-auto-equipment", label: "Equipment automatisch kaufen" },
    { key: "autoTerritoryWarfare", action: "toggle-gang-auto-territory", label: "Territory Warfare automatisch steuern" },
  ];

  for (const option of options) {
    const label = doc.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "6px";
    label.style.cursor = "pointer";

    const checkbox = doc.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.action = option.action;
    checkbox.style.cursor = "pointer";

    const text = doc.createElement("span");
    text.textContent = option.label;

    label.append(checkbox, text);
    wrap.appendChild(label);
    checkboxes.set(option.key, checkbox);
  }

  return { wrap, checkboxes };
}

function buildServerAdminSection(doc) {
  const wrap = doc.createElement("div");
  wrap.style.padding = "0 12px 12px";

  const card = doc.createElement("div");
  card.style.padding = "10px 12px";
  card.style.border = "1px solid rgba(255,255,255,0.08)";
  card.style.borderRadius = "10px";
  card.style.background = "rgba(255,255,255,0.03)";

  const title = doc.createElement("div");
  title.textContent = "Server Admin";
  title.style.fontSize = "14px";
  title.style.fontWeight = "700";

  const subtitle = doc.createElement("div");
  subtitle.textContent = `${NEW_SERVER_BUY_SCRIPT} | ${UPGRADE_SERVER_SCRIPT}`;
  subtitle.style.fontSize = "11px";
  subtitle.style.color = "#7fa6c8";
  subtitle.style.marginTop = "3px";

  const buyRow = doc.createElement("div");
  buyRow.style.display = "grid";
  buyRow.style.gridTemplateColumns = "1fr auto";
  buyRow.style.gap = "8px";
  buyRow.style.marginTop = "10px";

  const buyRamSelect = makeRamSelect(doc, BUY_RAM_DEFAULT, "buy-server-ram");
  const buyButton = makeButton(doc, "Buy Server", "buy-server");
  styleActionButton(buyButton, "start");
  buyRow.append(buyRamSelect, buyButton);

  const upgradeRow = doc.createElement("div");
  upgradeRow.style.display = "grid";
  upgradeRow.style.gridTemplateColumns = "1fr auto";
  upgradeRow.style.gap = "8px";
  upgradeRow.style.marginTop = "8px";

  const upgradeRamSelect = makeRamSelect(doc, UPGRADE_RAM_DEFAULT, "upgrade-server-ram");
  const upgradeButton = makeButton(doc, "Prepare Upgrade", "request-upgrade-server");
  styleActionButton(upgradeButton, "neutral");
  upgradeRow.append(upgradeRamSelect, upgradeButton);

  const confirmWrap = doc.createElement("div");
  confirmWrap.style.display = "none";
  confirmWrap.style.marginTop = "8px";
  confirmWrap.style.padding = "8px";
  confirmWrap.style.border = "1px solid rgba(255,126,153,0.28)";
  confirmWrap.style.borderRadius = "8px";
  confirmWrap.style.background = "rgba(120,30,46,0.18)";

  const confirmText = doc.createElement("div");
  confirmText.style.fontSize = "11px";
  confirmText.style.color = "#ffd2db";

  const confirmButtons = doc.createElement("div");
  confirmButtons.style.display = "flex";
  confirmButtons.style.gap = "8px";
  confirmButtons.style.marginTop = "8px";

  const confirmUpgradeButton = makeButton(doc, "Confirm Upgrade", "confirm-upgrade-server");
  const cancelUpgradeButton = makeButton(doc, "Cancel", "cancel-upgrade-server");
  confirmUpgradeButton.style.flex = "1";
  cancelUpgradeButton.style.flex = "1";
  styleActionButton(confirmUpgradeButton, "stop");
  styleActionButton(cancelUpgradeButton, "neutral");
  confirmButtons.append(confirmUpgradeButton, cancelUpgradeButton);
  confirmWrap.append(confirmText, confirmButtons);

  const details = doc.createElement("div");
  details.style.marginTop = "8px";
  details.style.fontSize = "11px";
  details.style.color = "#b9d1e7";
  details.style.whiteSpace = "pre-line";

  // Auto-Upgrade Checkbox
  const autoUpgradeRow = doc.createElement("div");
  autoUpgradeRow.style.marginTop = "8px";
  autoUpgradeRow.style.display = "flex";
  autoUpgradeRow.style.flexDirection = "column";
  autoUpgradeRow.style.gap = "6px";

  function makeAutoCheckbox(action, text) {
    const label = doc.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "6px";
    label.style.cursor = "pointer";
    label.style.fontSize = "11px";
    label.style.color = "#c6d8eb";
    const cb = doc.createElement("input");
    cb.type = "checkbox";
    cb.dataset.action = action;
    cb.style.cursor = "pointer";
    const span = doc.createElement("span");
    span.textContent = text;
    label.append(cb, span);
    autoUpgradeRow.appendChild(label);
    return cb;
  }

  const autoUpgradeCheckbox = makeAutoCheckbox("toggle-auto-upgrade-server", "Auto-Upgrade: Server upgraden wenn Geld reicht");
  const autoBuyCheckbox     = makeAutoCheckbox("toggle-auto-buy-server",     "Auto-Buy: neue Server kaufen wenn Geld reicht");

  card.append(title, subtitle, buyRow, upgradeRow, confirmWrap, autoUpgradeRow, details);
  wrap.appendChild(card);

  return {
    wrap,
    buyRamSelect,
    upgradeRamSelect,
    buyButton,
    upgradeButton,
    confirmWrap,
    confirmText,
    confirmUpgradeButton,
    cancelUpgradeButton,
    autoUpgradeCheckbox,
    autoBuyCheckbox,
    details,
    upgradePending: false,
  };
}

function makeRamSelect(doc, defaultValue, name) {
  const select = doc.createElement("select");
  select.dataset.name = name;
  select.style.border = "1px solid rgba(120,190,255,0.28)";
  select.style.background = "rgba(19,31,49,0.72)";
  select.style.color = "#eef6ff";
  select.style.borderRadius = "8px";
  select.style.padding = "8px 10px";
  select.style.font = "inherit";
  select.style.cursor = "pointer";

  for (const ram of RAM_OPTIONS) {
    const option = doc.createElement("option");
    option.value = String(ram);
    option.textContent = formatRamOption(ram);
    if (ram === defaultValue) {
      option.selected = true;
    }
    select.appendChild(option);
  }

  return select;
}

function formatRamOption(ram) {
  if (ram >= 1024) {
    return `${ram} GB (${(ram / 1024).toFixed(ram % 1024 === 0 ? 0 : 1)} TB)`;
  }
  return `${ram} GB`;
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
      const select = event.target.closest("select[data-name]");
      if (!select) {
        return;
      }

      if (select.dataset.name === "upgrade-server-ram") {
        actionQueue.push("reset-upgrade-confirmation");
      }
      actionQueue.push("save-gui-state");
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

function processQueuedActions(ns, panel, actionQueue) {
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

    if (action === "save-gui-state") {
      saveGuiState(ns, panel);
      continue;
    }

    if (action === "reset-upgrade-confirmation") {
      panel.admin.upgradePending = false;
      continue;
    }

    if (action === "buy-server") {
      panel.admin.upgradePending = false;
      startScriptIfIdle(ns, NEW_SERVER_BUY_SCRIPT, getSelectedRam(panel.admin.buyRamSelect, BUY_RAM_DEFAULT));
      continue;
    }

    if (action === "toggle-auto-upgrade-server") {
      saveGuiState(ns, panel);
      continue;
    }

    if (action === "toggle-auto-buy-server") {
      saveGuiState(ns, panel);
      continue;
    }

    if (action === "request-upgrade-server") {
      panel.admin.upgradePending = true;
      continue;
    }

    if (action === "cancel-upgrade-server") {
      panel.admin.upgradePending = false;
      continue;
    }

    if (action === "confirm-upgrade-server") {
      startScriptIfIdle(ns, UPGRADE_SERVER_SCRIPT, getSelectedRam(panel.admin.upgradeRamSelect, UPGRADE_RAM_DEFAULT), true);
      panel.admin.upgradePending = false;
      continue;
    }

    if (action.startsWith("toggle-combat-stat:")) {
      const stat = action.split(":")[1];
      toggleCombatTrainerStat(ns, stat);
      continue;
    }

    if (action === "toggle-combat-focus") {
      toggleCombatTrainerFocus(ns);
      continue;
    }

    if (action === "toggle-gang-auto-ascend") {
      toggleGangAutoAscend(ns);
      continue;
    }

    if (action === "toggle-gang-auto-equipment") {
      toggleGangAutoEquipment(ns);
      continue;
    }

    if (action === "toggle-gang-auto-territory") {
      toggleGangAutoTerritoryWarfare(ns);
      continue;
    }

    if (action.startsWith("toggle:")) {
      const key = action.split(":")[1];
      toggleService(ns, key);
    }
  }
}

function enableWindowBehavior(doc, panel, actionQueue, config) {
  const state = {
    dragging: false,
    offsetX: 0,
    offsetY: 0,
    hidden: getGuiState(config).panel.hidden,
  };
  panel.windowState = state;

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

  panel.setHidden = setHidden;

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
    const wasDragging = state.dragging;
    state.dragging = false;
    doc.body.style.userSelect = "";
    if (wasDragging) {
      actionQueue.push("save-gui-state");
    }
  };

  const onToggleVisibility = event => {
    const button = event.target.closest("button[data-action='toggle-visibility']");
    if (!button) {
      return;
    }

    setHidden(!state.hidden);
    actionQueue.push("save-gui-state");
  };

  panel.header.addEventListener("mousedown", onMouseDown);
  doc.addEventListener("mousemove", onMouseMove);
  doc.addEventListener("mouseup", onMouseUp);
  panel.root.addEventListener("click", onToggleVisibility);
  panel.launcher.addEventListener("click", onToggleVisibility);
  syncLauncherPosition();
  setHidden(state.hidden);

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
  const purchasedServers = ns.getPurchasedServers().filter(server => server.startsWith("MeinServer_"));
  const purchasedLimit = ns.getPurchasedServerLimit();
  const buyScriptExists = ns.fileExists(NEW_SERVER_BUY_SCRIPT, "home");
  const upgradeScriptExists = ns.fileExists(UPGRADE_SERVER_SCRIPT, "home");
  const buyRunning = ns.scriptRunning(NEW_SERVER_BUY_SCRIPT, "home");
  const upgradeRunning = ns.scriptRunning(UPGRADE_SERVER_SCRIPT, "home");
  const buyRam = getSelectedRam(panel.admin.buyRamSelect, BUY_RAM_DEFAULT);
  const upgradeRam = getSelectedRam(panel.admin.upgradeRamSelect, UPGRADE_RAM_DEFAULT);
  const playerMoney = ns.getPlayer().money;
  const buyPlan = getBuyPlan(ns, purchasedServers, purchasedLimit, buyRam);
  const upgradePlan = getUpgradePlan(ns, purchasedServers, upgradeRam);
  const combatTrainerConfig = getCombatTrainerConfig(config.services.combatTrainer || {});
  const gangConfig = getGangConfig(config.services.gang || {});
  const negativeKarmaConfig = getNegativeKarmaConfig(config.services.negativeKarma || {});

  panel.status.textContent = `Main Manager: ${managerRunning ? "RUNNING" : "STOPPED"}`;
  panel.loop.textContent = `Loop: ${Math.floor(config.loopMs / 1000)}s`;
  panel.startButton.disabled = managerRunning;
  panel.stopButton.disabled = !managerRunning;
  styleActionButton(panel.startButton, managerRunning ? "disabled" : "start");
  styleActionButton(panel.stopButton, managerRunning ? "stop" : "disabled");
  styleActionButton(panel.refreshButton, "neutral");

  // Auto-Upgrade: automatisch upgraden wenn aktiviert und genug Geld vorhanden
  const autoUpgradeEnabled = panel.admin.autoUpgradeCheckbox.checked;
  if (autoUpgradeEnabled && upgradeScriptExists && !upgradeRunning
      && upgradePlan.upgradableCount > 0 && upgradePlan.totalCost > 0
      && playerMoney >= upgradePlan.totalCost) {
    startScriptIfIdle(ns, UPGRADE_SERVER_SCRIPT, upgradeRam, true);
  }

  // Auto-Buy: automatisch neuen Server kaufen (immer kleinstes RAM = 8 GB, um Slots zu fuellen)
  const autoBuyEnabled = panel.admin.autoBuyCheckbox.checked;
  const autoBuyRam = RAM_OPTIONS[0]; // immer 8 GB
  const autoBuyCost = ns.getPurchasedServerCost(autoBuyRam);
  const autoBuyPlan = getBuyPlan(ns, purchasedServers, purchasedLimit, autoBuyRam);
  if (autoBuyEnabled && buyScriptExists && !buyRunning && !autoBuyPlan.blocked
      && autoBuyCost > 0 && playerMoney >= autoBuyCost) {
    startScriptIfIdle(ns, NEW_SERVER_BUY_SCRIPT, autoBuyRam);
  }

  panel.admin.buyButton.disabled = !buyScriptExists || buyRunning || buyPlan.blocked;
  panel.admin.upgradeButton.disabled = !upgradeScriptExists || upgradeRunning || upgradePlan.upgradableCount === 0;
  panel.admin.confirmUpgradeButton.disabled = !upgradeScriptExists || upgradeRunning || upgradePlan.upgradableCount === 0;
  panel.admin.cancelUpgradeButton.disabled = upgradeRunning;
  if (upgradeRunning) {
    panel.admin.upgradePending = false;
  }
  styleActionButton(panel.admin.buyButton, panel.admin.buyButton.disabled ? "disabled" : "start");
  styleActionButton(panel.admin.upgradeButton, panel.admin.upgradeButton.disabled ? "disabled" : "neutral");
  styleActionButton(panel.admin.confirmUpgradeButton, panel.admin.confirmUpgradeButton.disabled ? "disabled" : "stop");
  styleActionButton(panel.admin.cancelUpgradeButton, panel.admin.cancelUpgradeButton.disabled ? "disabled" : "neutral");
  panel.admin.confirmWrap.style.display = panel.admin.upgradePending ? "block" : "none";
  panel.admin.confirmText.textContent = `Upgrade ${upgradePlan.upgradableCount}/${purchasedServers.length} Server auf ${ns.formatRam(upgradeRam)} fuer insgesamt ${ns.formatNumber(upgradePlan.totalCost)}$. ${upgradePlan.blockedDowngrades > 0 ? `${upgradePlan.blockedDowngrades} groessere Server bleiben unveraendert.` : ""}`.trim(); 
  panel.admin.details.textContent = [
    `MeinServer: ${purchasedServers.length}/${purchasedLimit} | Geld: ${ns.formatNumber(playerMoney)}$`,
    `Buy ${ns.formatRam(buyRam)} -> ${buyPlan.targetName} | Kosten: ${ns.formatNumber(buyPlan.cost)}$ | ${buyPlan.status}`,
    `Upgrade ${ns.formatRam(upgradeRam)} -> ${upgradePlan.upgradableCount}/${purchasedServers.length} Server | Kosten: ${ns.formatNumber(upgradePlan.totalCost)}$ | ${upgradePlan.status}`,
    `Buy Script: ${buyScriptExists ? (buyRunning ? "RUNNING" : "READY") : "MISSING"} | Upgrade Script: ${upgradeScriptExists ? (upgradeRunning ? "RUNNING" : "READY") : "MISSING"}`,
  ].join("\n");

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
    row.details.style.whiteSpace = service.key === "combatTrainer" || service.key === "gang" || service.key === "negativeKarma" ? "pre-line" : "normal";
    row.details.textContent = service.key === "combatTrainer"
      ? buildCombatTrainerDetails(enabled, running, override, scriptExists, combatTrainerConfig)
      : service.key === "gang"
        ? buildGangDetails(enabled, running, override, scriptExists, gangConfig)
        : service.key === "negativeKarma"
          ? buildNegativeKarmaDetails(ns, enabled, running, override, scriptExists, negativeKarmaConfig, combatTrainerConfig)
        : [
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
      if (row.statControls.focusCheckbox) {
        row.statControls.focusCheckbox.checked = combatTrainerConfig.focus;
      }
    }

    if (service.key === "gang" && row.gangControls) {
      row.gangControls.checkboxes.get("autoAscend").checked = gangConfig.autoAscend;
      row.gangControls.checkboxes.get("autoEquipment").checked = gangConfig.autoEquipment;
      row.gangControls.checkboxes.get("autoTerritoryWarfare").checked = gangConfig.autoTerritoryWarfare;
    }
  }
}

function buildCombatTrainerDetails(enabled, running, override, scriptExists, trainerConfig) {
  const activeStats = Object.entries(trainerConfig.stats)
    .filter(([, selected]) => selected)
    .map(([stat]) => formatCombatStatLabel(stat))
    .join(", ");

  return [
    `Config: ${enabled ? "ON" : "OFF"} | Runtime: ${running ? "RUNNING" : "STOPPED"} | Threads: ${override.threads ?? 1} | ${scriptExists ? "Script: OK" : "Script: MISSING"}`,
    `Stats: ${activeStats || "keine"} | Focus: ${trainerConfig.focus ? "ON" : "OFF"}`,
    `Combat: Auto best gym (XP/s)`,
    `Charisma: Auto best university (XP/s) / ${trainerConfig.charismaCourse}`,
  ].join("\n");
}

function buildGangDetails(enabled, running, override, scriptExists, gangConfig) {
  return [
    `Config: ${enabled ? "ON" : "OFF"} | Runtime: ${running ? "RUNNING" : "STOPPED"} | Threads: ${override.threads ?? 1} | ${scriptExists ? "Script: OK" : "Script: MISSING"}`,
    `Auto-Ascend: ${gangConfig.autoAscend ? "ON" : "OFF"}`,
    `Auto-Equipment: ${gangConfig.autoEquipment ? "ON" : "OFF"}`,
    `Auto-Territory: ${gangConfig.autoTerritoryWarfare ? "ON" : "OFF"}`,
  ].join("\n");
}

function buildNegativeKarmaDetails(ns, enabled, running, override, scriptExists, negativeKarmaConfig, combatTrainerConfig) {
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
      "Crime: nicht verfuegbar",
      "Chance/Karma: n/a",
    ].join("\n");
  }

  const mode = negativeKarmaConfig.trainerManaged && combatTrainerConfigEnabled(combatTrainerConfig, currentWork)
    ? "Training fuer 90%"
    : isCrimeWork(currentWork, bestCrime.type)
      ? "Crime aktiv"
      : "Bereit";

  return [
    `Config: ${enabled ? "ON" : "OFF"} | Runtime: ${running ? "RUNNING" : "STOPPED"} | Threads: ${override.threads ?? 1} | ${scriptExists ? "Script: OK" : "Script: MISSING"}`,
    `Crime: ${bestCrime.type} | Chance: ${(bestCrime.chance * 100).toFixed(1)}% | Karma/s: ${bestCrime.karmaPerSecond.toFixed(3)}`,
    `Mode: ${mode} | Zielchance: 90.0%`,
    `Trainer-Stats: ${trainerStats || "keine"}`,
  ].join("\n");
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

function toggleGangAutoAscend(ns) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.gang || {};
  const gangConfig = getGangConfig(current);

  config.services.gang = {
    ...current,
    enabled: current.enabled ?? false,
    threads: current.threads ?? 1,
    args: Array.isArray(current.args) ? current.args : [],
    autoAscend: !gangConfig.autoAscend,
  };

  saveConfig(ns, CONFIG_FILE, config);
}

function toggleGangAutoEquipment(ns) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.gang || {};
  const gangConfig = getGangConfig(current);

  config.services.gang = {
    ...current,
    enabled: current.enabled ?? false,
    threads: current.threads ?? 1,
    args: Array.isArray(current.args) ? current.args : [],
    autoEquipment: !gangConfig.autoEquipment,
  };

  saveConfig(ns, CONFIG_FILE, config);
}

function toggleGangAutoTerritoryWarfare(ns) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.gang || {};
  const gangConfig = getGangConfig(current);

  config.services.gang = {
    ...current,
    enabled: current.enabled ?? false,
    threads: current.threads ?? 1,
    args: Array.isArray(current.args) ? current.args : [],
    autoTerritoryWarfare: !gangConfig.autoTerritoryWarfare,
  };

  saveConfig(ns, CONFIG_FILE, config);
}

function startScriptIfIdle(ns, script, ...args) {
  if (!ns.fileExists(script, "home")) {
    return;
  }

  if (ns.scriptRunning(script, "home")) {
    return;
  }

  ns.exec(script, "home", 1, ...args);
}

function getSelectedRam(select, fallback) {
  const numeric = Number(select?.value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function getCombatTrainerConfig(service) {
  const args = Array.isArray(service.args) ? service.args : [];
  const usesLegacyArgs = args.length >= 7;
  return {
    enabled: service.enabled ?? false,
    focus: usesLegacyArgs ? Boolean(args[3]) : Boolean(args[1]),
    charismaCourse: normalizeUniversityCourse((usesLegacyArgs ? args[6] : args[2]) || "Leadership"),
    stats: sanitizeCombatStatSelection(service.stats),
  };
}

function getGangConfig(service) {
  return {
    autoAscend: service.autoAscend ?? true,
    autoEquipment: service.autoEquipment ?? true,
    autoTerritoryWarfare: service.autoTerritoryWarfare ?? true,
  };
}

function getNegativeKarmaConfig(service) {
  return {
    trainerManaged: service.trainerManaged === true,
  };
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

function applySavedGuiState(panel, config) {
  const guiState = getGuiState(config);

  panel.admin.buyRamSelect.value = String(guiState.buyRam);
  panel.admin.upgradeRamSelect.value = String(guiState.upgradeRam);
  panel.admin.autoUpgradeCheckbox.checked = guiState.autoUpgrade;
  panel.admin.autoBuyCheckbox.checked = guiState.autoBuy;

  panel.root.style.top = guiState.panel.top || GUI_STATE_DEFAULT.panel.top;
  if (guiState.panel.left) {
    panel.root.style.left = guiState.panel.left;
    panel.root.style.right = "auto";
  } else {
    panel.root.style.left = "";
    panel.root.style.right = guiState.panel.right || GUI_STATE_DEFAULT.panel.right;
  }
}

function saveGuiState(ns, panel) {
  const config = loadConfig(ns, CONFIG_FILE);
  config.gui = config.gui && typeof config.gui === "object" ? config.gui : {};
  config.gui.managerGui = collectGuiState(panel);
  saveConfig(ns, CONFIG_FILE, config);
}

function collectGuiState(panel) {
  return {
    buyRam: getSelectedRam(panel.admin.buyRamSelect, BUY_RAM_DEFAULT),
    upgradeRam: getSelectedRam(panel.admin.upgradeRamSelect, UPGRADE_RAM_DEFAULT),
    autoUpgrade: panel.admin.autoUpgradeCheckbox?.checked ?? false,
    autoBuy: panel.admin.autoBuyCheckbox?.checked ?? false,
    panel: {
      top: panel.root.style.top || GUI_STATE_DEFAULT.panel.top,
      left: panel.root.style.left || "",
      right: panel.root.style.right || GUI_STATE_DEFAULT.panel.right,
      hidden: Boolean(panel.windowState?.hidden),
    },
  };
}

function getGuiState(config) {
  const raw = config?.gui?.managerGui;
  return sanitizeGuiState(raw);
}

function sanitizeGuiState(state) {
  const panel = state?.panel && typeof state.panel === "object" ? state.panel : {};

  return {
    buyRam: sanitizeGuiRam(state?.buyRam, BUY_RAM_DEFAULT),
    upgradeRam: sanitizeGuiRam(state?.upgradeRam, UPGRADE_RAM_DEFAULT),
    autoUpgrade: Boolean(state?.autoUpgrade),
    autoBuy: Boolean(state?.autoBuy),
    panel: {
      top: typeof panel.top === "string" && panel.top ? panel.top : GUI_STATE_DEFAULT.panel.top,
      left: typeof panel.left === "string" ? panel.left : GUI_STATE_DEFAULT.panel.left,
      right: typeof panel.right === "string" && panel.right ? panel.right : GUI_STATE_DEFAULT.panel.right,
      hidden: Boolean(panel.hidden),
    },
  };
}

function sanitizeGuiRam(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !RAM_OPTIONS.includes(numeric)) {
    return fallback;
  }

  return numeric;
}

function getBuyPlan(ns, purchasedServers, purchasedLimit, ram) {
  const index = purchasedServers.length;
  const targetName = `MeinServer_${index}`;
  const cost = ns.getPurchasedServerCost(ram);
  const atLimit = purchasedServers.length >= purchasedLimit;
  const nameExists = ns.serverExists(targetName);

  if (atLimit) {
    return { targetName, cost, blocked: true, status: "LIMIT" };
  }

  if (nameExists) {
    return { targetName, cost, blocked: true, status: "NAME EXISTS" };
  }

  return { targetName, cost, blocked: false, status: "READY" };
}

function getUpgradePlan(ns, purchasedServers, targetRam) {
  let totalCost = 0;
  let upgradableCount = 0;
  let blockedDowngrades = 0;

  for (const server of purchasedServers) {
    const currentRam = ns.getServerMaxRam(server);
    if (currentRam >= targetRam) {
      if (currentRam > targetRam) {
        blockedDowngrades++;
      }
      continue;
    }

    const cost = ns.getPurchasedServerUpgradeCost(server, targetRam);
    if (!Number.isFinite(cost) || cost <= 0) {
      continue;
    }

    totalCost += cost;
    upgradableCount++;
  }

  return {
    totalCost,
    upgradableCount,
    blockedDowngrades,
    status: upgradableCount > 0
      ? (blockedDowngrades > 0 ? `READY | ${blockedDowngrades} DOWNGRADE BLOCKED` : "READY")
      : (blockedDowngrades > 0 ? `NOTHING TO UPGRADE | ${blockedDowngrades} DOWNGRADE BLOCKED` : "NOTHING TO UPGRADE"),
  };
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
    gui: {},
  };

  const fileState = ensureJsonFile(ns, configFile, fallback);

  try {
    const parsed = fileState.value;
    return {
      loopMs: Number(parsed.loopMs) || fallback.loopMs,
      tail: parsed.tail !== false,
      services: parsed.services && typeof parsed.services === "object" ? parsed.services : {},
      gui: parsed.gui && typeof parsed.gui === "object" ? parsed.gui : {},
    };
  } catch {
    return fallback;
  }
}

function saveConfig(ns, configFile, config) {
  ns.write(configFile, JSON.stringify(config, null, 2), "w");
}