import { loadConfig, saveConfig, CONFIG_FILE } from "./manager_gui_utils.js";

// --- DOM builder ---

export function buildGangControls(doc) {
  const wrap = doc.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gridTemplateColumns = "minmax(0, 1fr)";
  wrap.style.gap = "6px";
  wrap.style.marginTop = "10px";
  wrap.style.fontSize = "11px";
  wrap.style.color = "#c6d8eb";

  const checkboxes = new Map();
  const options = [
    { key: "autoAscend",            action: "toggle-gang-auto-ascend",      label: "Auto-level members" },
    { key: "autoEquipment",         action: "toggle-gang-auto-equipment",   label: "Auto-buy equipment" },
    { key: "autoTerritoryWarfare",  action: "toggle-gang-auto-territory",   label: "Auto-manage Territory Warfare" },
    { key: "prepCombatMode",        action: "toggle-gang-prep-combat",      label: "Train combat stats (prep mode)" },
    { key: "powerFarmMode",         action: "toggle-gang-power-farm",       label: "Power Farm Mode (Territory Power, no Clashes)" },
    { key: "respectFarmMode",       action: "toggle-gang-respect-farm",     label: "Respect Farm Mode (always Cyberterrorism)" },
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

// --- Config getter ---

export function getGangConfig(service) {
  return {
    autoAscend: service.autoAscend ?? true,
    autoEquipment: service.autoEquipment ?? true,
    autoTerritoryWarfare: service.autoTerritoryWarfare ?? true,
    prepCombatMode: service.prepCombatMode ?? false,
    powerFarmMode: service.powerFarmMode ?? false,
    respectFarmMode: service.respectFarmMode ?? false,
  };
}

// --- Details builder ---

export function buildGangDetails(enabled, running, override, scriptExists, gangConfig) {
  return [
    `Config: ${enabled ? "ON" : "OFF"} | Runtime: ${running ? "RUNNING" : "STOPPED"} | Threads: ${override.threads ?? 1} | ${scriptExists ? "Script: OK" : "Script: MISSING"}`,
    `Auto-Ascend: ${gangConfig.autoAscend ? "ON" : "OFF"}`,
    `Auto-Equipment: ${gangConfig.autoEquipment ? "ON" : "OFF"}`,
    `Auto-Territory: ${gangConfig.autoTerritoryWarfare ? "ON" : "OFF"}`,
  ].join("\n");
}

// --- Controls sync ---

export function syncGangControls(row, gangConfig) {
  if (!row.gangControls) return;
  row.gangControls.checkboxes.get("autoAscend").checked = gangConfig.autoAscend;
  row.gangControls.checkboxes.get("autoEquipment").checked = gangConfig.autoEquipment;
  row.gangControls.checkboxes.get("autoTerritoryWarfare").checked = gangConfig.autoTerritoryWarfare;
  row.gangControls.checkboxes.get("prepCombatMode").checked = gangConfig.prepCombatMode;
  row.gangControls.checkboxes.get("powerFarmMode").checked = gangConfig.powerFarmMode;
  row.gangControls.checkboxes.get("respectFarmMode").checked = gangConfig.respectFarmMode;
}

// --- Action handler ---

export function handleGangAction(ns, action) {
  if (action === "toggle-gang-auto-ascend") { toggleGangAutoAscend(ns); return true; }
  if (action === "toggle-gang-auto-equipment") { toggleGangAutoEquipment(ns); return true; }
  if (action === "toggle-gang-auto-territory") { toggleGangAutoTerritoryWarfare(ns); return true; }
  if (action === "toggle-gang-prep-combat") { toggleGangPrepCombat(ns); return true; }
  if (action === "toggle-gang-power-farm") { toggleGangPowerFarm(ns); return true; }
  if (action === "toggle-gang-respect-farm") { toggleGangRespectFarm(ns); return true; }
  return false;
}

// --- Private toggle helpers ---

function toggleGangAutoAscend(ns) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.gang || {};
  const gangConfig = getGangConfig(current);
  config.services.gang = { ...current, enabled: current.enabled ?? false, threads: current.threads ?? 1, args: Array.isArray(current.args) ? current.args : [], autoAscend: !gangConfig.autoAscend };
  saveConfig(ns, CONFIG_FILE, config);
}

function toggleGangAutoEquipment(ns) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.gang || {};
  const gangConfig = getGangConfig(current);
  config.services.gang = { ...current, enabled: current.enabled ?? false, threads: current.threads ?? 1, args: Array.isArray(current.args) ? current.args : [], autoEquipment: !gangConfig.autoEquipment };
  saveConfig(ns, CONFIG_FILE, config);
}

function toggleGangAutoTerritoryWarfare(ns) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.gang || {};
  const gangConfig = getGangConfig(current);
  config.services.gang = { ...current, enabled: current.enabled ?? false, threads: current.threads ?? 1, args: Array.isArray(current.args) ? current.args : [], autoTerritoryWarfare: !gangConfig.autoTerritoryWarfare };
  saveConfig(ns, CONFIG_FILE, config);
}

function toggleGangPrepCombat(ns) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.gang || {};
  const gangConfig = getGangConfig(current);
  config.services.gang = { ...current, enabled: current.enabled ?? false, threads: current.threads ?? 1, args: Array.isArray(current.args) ? current.args : [], prepCombatMode: !gangConfig.prepCombatMode };
  saveConfig(ns, CONFIG_FILE, config);
}

function toggleGangPowerFarm(ns) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.gang || {};
  const gangConfig = getGangConfig(current);
  config.services.gang = { ...current, enabled: current.enabled ?? false, threads: current.threads ?? 1, args: Array.isArray(current.args) ? current.args : [], powerFarmMode: !gangConfig.powerFarmMode };
  saveConfig(ns, CONFIG_FILE, config);
}

function toggleGangRespectFarm(ns) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.gang || {};
  const gangConfig = getGangConfig(current);
  config.services.gang = { ...current, enabled: current.enabled ?? false, threads: current.threads ?? 1, args: Array.isArray(current.args) ? current.args : [], respectFarmMode: !gangConfig.respectFarmMode };
  saveConfig(ns, CONFIG_FILE, config);
}
