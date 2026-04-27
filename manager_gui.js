/** @param {NS} ns */
import { makeButton, styleActionButton, loadConfig, saveConfig, CONFIG_FILE, RAM_OPTIONS, BUY_RAM_DEFAULT, UPGRADE_RAM_DEFAULT } from "./manager_gui_utils.js";
import { buildCombatStatControls, getCombatTrainerConfig, getNegativeKarmaConfig, buildCombatTrainerDetails, buildNegativeKarmaDetails, syncCombatTrainerControls, handleTrainingAction } from "./manager_gui_tab_training.js";
import { buildGangControls, getGangConfig, buildGangDetails, syncGangControls, handleGangAction } from "./manager_gui_tab_gang.js";
import { buildAugmentControls, getAugmentConfig, buildAugmentDetails, syncAugmentControls, handleAugmentAction } from "./manager_gui_tab_augments.js";
import { buildHacknetControls, buildProgramsControls, syncHacknetControls, syncProgramsControls, handleServicesAction } from "./manager_gui_tab_services.js";
import { buildServerAdminSection, renderServerTab, handleServerAction, getSelectedRam } from "./manager_gui_tab_server.js";
import { buildCorpControls, buildCorpDetails, syncCorpControls, handleCorpAction } from "./manager_gui_tab_corp.js";
import { buildIpvgoControls, getIpvgoConfig, buildIpvgoDetails, syncIpvgoControls, handleIpvgoAction } from "./manager_gui_tab_ipvgo.js";
import { buildInfiltratePane, renderInfiltratePane, handleInfiltrateAction } from "./manager_gui_tab_infiltrate.js";
import { buildBladeburnerPane, renderBladeburnerPane } from "./manager_gui_tab_bladeburner.js";

const PANEL_ID = "bitburner-main-manager-gui";
const REFRESH_MS = 1000;
const MAIN_MANAGER_SCRIPT = "main_manager.js";
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
  { key: "crime", script: "manager_crime.js", host: "home", label: "Money Crime" },
  { key: "programs", script: "auto-leveler.js", host: "home", label: "Buy Programs" },
  { key: "combatTrainer", script: "combat_stat_trainer.js", host: "home", label: "Stat Trainer" },
  { key: "playerStatsWorker", script: "player_stats_worker.js", host: "home", label: "Stats Writer" },
  { key: "playerStatsView", script: "player_stats.js", host: "home", label: "Stats View" },
  { key: "overview", script: "overview.js", host: "home", label: "Overview" },
  { key: "augments", script: "manager_augments.js", host: "home", label: "Augments" },
  { key: "backdoor", script: "manager_backdoor.js", host: "home", label: "Backdoor" },
  { key: "ipvgo", script: "manager_ipvgo.js", host: "home", label: "IPvGO" },
  { key: "corporation", script: "manager_corporation.js", host: "home", label: "Corporation" },
  { key: "serverAdmin", script: "manager_server.js", host: "home", label: "Server Admin" },
];

const TABS = [
  { id: "services", label: "Services" },
  { id: "training", label: "Training" },
  { id: "gang", label: "Gang" },
  { id: "augments", label: "Augments" },
  { id: "server", label: "Server" },
  { id: "corporation", label: "Corp" },
  { id: "ipvgo", label: "IPvGO" },
  { id: "infiltrate", label: "Infiltrate" },
  { id: "bladeburner", label: "BB" },
];

// display type used when a tab pane is active1
const TAB_DISPLAY_TYPE = { services: "grid", training: "grid", gang: "grid", augments: "block", server: "block", corporation: "block", ipvgo: "block", infiltrate: "block", bladeburner: "block" };

function getServiceTab(key) {
  if (key === "negativeKarma" || key === "combatTrainer" || key === "crime") return "training";
  if (key === "gang") return "gang";
  if (key === "augments") return "augments";
  if (key === "ipvgo") return "ipvgo";
  if (key === "corporation") return "corporation";
  if (key === "serverAdmin") return "server";
  return "services";
}

export async function main(ns) {
  ns.disableLog("ALL");

  const doc = getDocument();
  if (!doc) {
    ns.tprint("GUI not available. Alternatively, a prompt-based menu could be built.");
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
  root.style.width = "480px";
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
  startButton.style.flex = "1";
  stopButton.style.flex = "1";
  topBar.append(startButton, stopButton);

  const meta = doc.createElement("div");
  meta.style.display = "flex";
  meta.style.gap = "16px";
  meta.style.padding = "8px 16px 0";
  meta.style.fontSize = "12px";
  meta.style.color = "#9fc0de";

  const status = doc.createElement("div");
  const loop = doc.createElement("div");
  meta.append(status, loop);

  // Tab bar
  const tabBar = doc.createElement("div");
  tabBar.style.display = "flex";
  tabBar.style.flexWrap = "wrap";
  tabBar.style.padding = "0 8px";
  tabBar.style.marginTop = "8px";
  tabBar.style.borderBottom = "1px solid rgba(120,190,255,0.15)";

  const tabButtons = new Map();
  for (const tab of TABS) {
    const btn = doc.createElement("button");
    btn.textContent = tab.label;
    btn.dataset.tab = tab.id;
    btn.style.background = "none";
    btn.style.border = "none";
    btn.style.borderBottom = "2px solid transparent";
    btn.style.color = "#8db3d9";
    btn.style.padding = "7px 10px";
    btn.style.cursor = "pointer";
    btn.style.font = "inherit";
    btn.style.fontSize = "12px";
    btn.style.whiteSpace = "nowrap";
    tabBar.appendChild(btn);
    tabButtons.set(tab.id, btn);
  }

  // Tab panes
  const tabPanes = new Map();
  for (const tab of TABS) {
    const pane = doc.createElement("div");
    pane.style.display = "none";
    tabPanes.set(tab.id, pane);
  }

  // Services pane: 2-column grid
  const servicesPane = tabPanes.get("services");
  servicesPane.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
  servicesPane.style.gap = "8px";
  servicesPane.style.padding = "12px";

  // Training & Gang panes: single-column grid
  for (const id of ["training", "gang"]) {
    const pane = tabPanes.get(id);
    pane.style.gap = "10px";
    pane.style.padding = "12px";
  }

  // Augments pane: single block
  const augmentsPane = tabPanes.get("augments");
  augmentsPane.style.padding = "12px";

  // Corporation pane: single block
  const corpPane = tabPanes.get("corporation");
  corpPane.style.padding = "12px";

  function switchTab(id) {
    for (const [tid, pane] of tabPanes) {
      pane.style.display = tid === id ? TAB_DISPLAY_TYPE[tid] : "none";
    }
    for (const [tid, btn] of tabButtons) {
      const active = tid === id;
      btn.style.color = active ? "#e5eef7" : "#8db3d9";
      btn.style.borderBottomColor = active ? "rgba(120,190,255,0.8)" : "transparent";
      btn.style.fontWeight = active ? "700" : "400";
    }
  }

  tabBar.addEventListener("click", event => {
    const btn = event.target.closest("[data-tab]");
    if (btn && tabPanes.has(btn.dataset.tab)) {
      switchTab(btn.dataset.tab);
    }
  });

  const rows = new Map();
  const admin = buildServerAdminSection(doc);
  for (const service of SERVICES) {
    const tabId = getServiceTab(service.key);
    const pane = tabPanes.get(tabId);
    const isCompact = tabId === "services";

    const row = doc.createElement("div");
    row.style.border = "1px solid rgba(255,255,255,0.08)";
    row.style.borderRadius = "10px";
    row.style.background = "rgba(255,255,255,0.03)";

    const top = doc.createElement("div");
    top.style.display = "flex";
    top.style.alignItems = "center";
    top.style.justifyContent = "space-between";
    top.style.gap = isCompact ? "6px" : "10px";

    const toggle = makeButton(doc, "", `toggle:${service.key}`);

    if (isCompact) {
      row.style.padding = "8px 10px";

      const labelEl = doc.createElement("div");
      labelEl.textContent = service.label;
      labelEl.style.fontSize = "13px";
      labelEl.style.fontWeight = "700";
      top.append(labelEl, toggle);

      toggle.style.minWidth = "72px";
      toggle.style.padding = "5px 8px";
      toggle.style.fontSize = "11px";

      const details = doc.createElement("div");
      details.style.marginTop = "5px";
      details.style.fontSize = "10px";
      details.style.color = "#b9d1e7";
      details.style.whiteSpace = "pre-line";

      let programsControls = null;
      let hacknetControls = null;
      if (service.key === "programs") {
        programsControls = buildProgramsControls(doc);
        row.append(top, details, programsControls.wrap);
      } else if (service.key === "hacknet") {
        hacknetControls = buildHacknetControls(doc);
        row.append(top, details, hacknetControls.wrap);
      } else {
        row.append(top, details);
      }
      rows.set(service.key, { toggle, details, row, statControls: null, gangControls: null, programsControls, hacknetControls });
    } else {
      row.style.padding = "10px 12px";

      const labelWrap = doc.createElement("div");
      const labelEl = doc.createElement("div");
      labelEl.textContent = service.label;
      labelEl.style.fontSize = "14px";
      labelEl.style.fontWeight = "700";

      const scriptEl = doc.createElement("div");
      scriptEl.textContent = service.script;
      scriptEl.style.fontSize = "11px";
      scriptEl.style.color = "#7fa6c8";
      scriptEl.style.marginTop = "3px";
      labelWrap.append(labelEl, scriptEl);

      top.append(labelWrap, toggle);
      toggle.style.minWidth = "88px";

      const details = doc.createElement("div");
      details.style.marginTop = "8px";
      details.style.fontSize = "11px";
      details.style.color = "#b9d1e7";

      let statControls = null;
      let gangControls = null;
      let augmentControls = null;
      let ipvgoControls = null;
      let corpControls = null;
      let programsControls = null;
      let hacknetControls = null;
      if (service.key === "combatTrainer") {
        statControls = buildCombatStatControls(doc);
        row.append(top, details, statControls.wrap);
      } else if (service.key === "gang") {
        gangControls = buildGangControls(doc);
        row.append(top, details, gangControls.wrap);
      } else if (service.key === "augments") {
        augmentControls = buildAugmentControls(doc);
        row.append(top, details, augmentControls.wrap);
      } else if (service.key === "programs") {
        programsControls = buildProgramsControls(doc);
        row.append(top, details, programsControls.wrap);
      } else if (service.key === "hacknet") {
        hacknetControls = buildHacknetControls(doc);
        row.append(top, details, hacknetControls.wrap);
      } else if (service.key === "ipvgo") {
        ipvgoControls = buildIpvgoControls(doc);
        row.append(top, details, ipvgoControls.wrap);
      } else if (service.key === "corporation") {
        corpControls = buildCorpControls(doc);
        row.append(top, details, corpControls.wrap);
      } else {
        row.append(top, details);
      }

      rows.set(service.key, { toggle, details, row, statControls, gangControls, augmentControls, ipvgoControls, corpControls, programsControls, hacknetControls });
    }

    pane.appendChild(row);
  }

  tabPanes.get("server").appendChild(admin.wrap);

  const infiltratePane = buildInfiltratePane(doc);
  tabPanes.get("infiltrate").appendChild(infiltratePane.wrap);

  const bladeburnerPane = buildBladeburnerPane(doc);
  tabPanes.get("bladeburner").appendChild(bladeburnerPane.wrap);

  switchTab("services");

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

  const tabContent = doc.createElement("div");
  for (const pane of tabPanes.values()) {
    tabContent.appendChild(pane);
  }

  const content = doc.createElement("div");
  content.append(topBar, meta, tabBar, tabContent);

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
    minimizeButton,
    admin,
    rows,
    infiltrate: infiltratePane,
    bladeburner: bladeburnerPane,
  };
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
      const selectAction = event.target.closest("select[data-action]");
      if (selectAction) {
        // Build action: if data-action is just a prefix (no colon), append the select's current value
        const base = selectAction.dataset.action || "";
        const action = base.includes(":") ? base : (base ? `${base}:${selectAction.value}` : "");
        actionQueue.push(action);
        return;
      }

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

  // Wire IPvGO selects directly — bypasses the event.target.closest() chain
  const ipvgoRow = panel.rows.get("ipvgo");
  if (ipvgoRow?.ipvgoControls) {
    ipvgoRow.ipvgoControls.opponentSelect.addEventListener("change", e => {
      actionQueue.push(`set-ipvgo-opponent:${e.target.value}`);
    });
    ipvgoRow.ipvgoControls.boardSizeSelect.addEventListener("change", e => {
      actionQueue.push(`set-ipvgo-boardsize:${e.target.value}`);
    });
  }
}

function processQueuedActions(ns, panel, actionQueue) {
  while (actionQueue.length > 0) {
    const action = actionQueue.shift();

    if (action === "start-manager") { startMainManager(ns); continue; }
    if (action === "stop-manager") { ns.scriptKill(MAIN_MANAGER_SCRIPT, "home"); continue; }
    if (action === "toggle-visibility") { continue; }
    if (action === "save-gui-state") { saveGuiState(ns, panel); continue; }
    if (action === "toggle-auto-upgrade-server") { saveGuiState(ns, panel); continue; }
    if (action === "toggle-auto-buy-server") { saveGuiState(ns, panel); continue; }

    if (handleServerAction(ns, panel, action)) continue;
    if (handleTrainingAction(ns, action)) continue;
    if (handleGangAction(ns, action)) continue;
    if (handleAugmentAction(ns, action)) continue;
    if (handleServicesAction(ns, action)) continue;
    if (handleCorpAction(ns, action)) continue;
    if (handleIpvgoAction(ns, action)) continue;
    if (handleInfiltrateAction(ns, panel, action)) continue;

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

  panel.status.textContent = `Main Manager: ${managerRunning ? "RUNNING" : "STOPPED"}`;
  panel.loop.textContent = `Loop: ${Math.floor(config.loopMs / 1000)}s`;
  panel.startButton.disabled = managerRunning;
  panel.stopButton.disabled = !managerRunning;
  styleActionButton(panel.startButton, managerRunning ? "disabled" : "start");
  styleActionButton(panel.stopButton, managerRunning ? "stop" : "disabled");

  renderServerTab(ns, panel);

  const combatTrainerConfig = getCombatTrainerConfig(config.services.combatTrainer || {});
  const gangConfig = getGangConfig(config.services.gang || {});
  const negativeKarmaConfig = getNegativeKarmaConfig(config.services.negativeKarma || {});
  const augmentConfig = getAugmentConfig(config.services.augments || {});
  const ipvgoConfig = getIpvgoConfig(config.services.ipvgo || {});

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
    row.details.style.whiteSpace = "pre-line";
    row.details.textContent = service.key === "combatTrainer"
      ? buildCombatTrainerDetails(enabled, running, override, scriptExists, combatTrainerConfig)
      : service.key === "gang"
        ? buildGangDetails(enabled, running, override, scriptExists, gangConfig)
        : service.key === "negativeKarma"
          ? buildNegativeKarmaDetails(ns, enabled, running, override, scriptExists, negativeKarmaConfig, combatTrainerConfig)
          : service.key === "augments"
            ? buildAugmentDetails(ns, enabled, running, override, scriptExists, augmentConfig)
            : service.key === "ipvgo"
              ? buildIpvgoDetails(enabled, running, override, scriptExists, ipvgoConfig)
              : service.key === "corporation"
                ? buildCorpDetails(ns, enabled, running, override, scriptExists)
                : buildDefaultServiceDetails(enabled, running, override, scriptExists);
    row.row.style.borderColor = enabled ? "rgba(86,201,120,0.35)" : "rgba(255,255,255,0.08)";

    if (service.key === "combatTrainer") syncCombatTrainerControls(row, override, combatTrainerConfig);
    if (service.key === "gang") syncGangControls(row, gangConfig);
    if (service.key === "augments") syncAugmentControls(row, augmentConfig);
    if (service.key === "programs") syncProgramsControls(row, config.services.programs || {});
    if (service.key === "hacknet") syncHacknetControls(row, config.services.hacknet || {});
    if (service.key === "ipvgo") syncIpvgoControls(row, ipvgoConfig);
    if (service.key === "corporation") syncCorpControls(row, override);
  }

  if (panel.infiltrate) renderInfiltratePane(ns, panel);
  if (panel.bladeburner) renderBladeburnerPane(ns, panel);
}

function buildDefaultServiceDetails(enabled, running, override, scriptExists) {
  return [
    `Config: ${enabled ? "ON" : "OFF"} | Runtime: ${running ? "RUNNING" : "STOPPED"}`,
    `Threads: ${override.threads ?? 1} | ${scriptExists ? "Script: OK" : "Script: MISSING"}`,
  ].join("\n");
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

function startMainManager(ns) {
  if (!ns.scriptRunning(MAIN_MANAGER_SCRIPT, "home")) {
    ns.exec(MAIN_MANAGER_SCRIPT, "home", 1);
  }
}