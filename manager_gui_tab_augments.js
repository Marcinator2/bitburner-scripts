import { loadConfig, saveConfig, CONFIG_FILE } from "./manager_gui_utils.js";

// --- DOM builder ---

export function buildAugmentControls(doc) {
  const wrap = doc.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
  wrap.style.gap = "6px 10px";
  wrap.style.marginTop = "10px";
  wrap.style.fontSize = "11px";
  wrap.style.color = "#c6d8eb";

  const checkboxes = new Map();
  const options = [
    { key: "hacking",     action: "toggle-augment-cat:hacking",     label: "Hacking" },
    { key: "combat",      action: "toggle-augment-cat:combat",      label: "Combat" },
    { key: "hacknet",     action: "toggle-augment-cat:hacknet",     label: "Hacknet" },
    { key: "bladeburner", action: "toggle-augment-cat:bladeburner", label: "Bladeburner" },
    { key: "charisma",    action: "toggle-augment-cat:charisma",    label: "Charisma / Rep" },
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

  const divider = doc.createElement("div");
  divider.style.gridColumn = "1 / -1";
  divider.style.borderTop = "1px solid rgba(255,255,255,0.10)";
  divider.style.marginTop = "4px";
  wrap.appendChild(divider);

  const repLabel = doc.createElement("label");
  repLabel.style.display = "flex";
  repLabel.style.alignItems = "center";
  repLabel.style.gap = "6px";
  repLabel.style.cursor = "pointer";
  repLabel.style.gridColumn = "1 / -1";

  const repCheckbox = doc.createElement("input");
  repCheckbox.type = "checkbox";
  repCheckbox.dataset.action = "toggle-augment-rep-farming";
  repCheckbox.style.cursor = "pointer";

  const repText = doc.createElement("span");
  repText.textContent = "Rep-Farming when rep is missing";

  repLabel.append(repCheckbox, repText);
  wrap.appendChild(repLabel);

  const focusLabel = doc.createElement("label");
  focusLabel.style.display = "flex";
  focusLabel.style.alignItems = "center";
  focusLabel.style.gap = "6px";
  focusLabel.style.cursor = "pointer";
  focusLabel.style.gridColumn = "1 / -1";

  const focusCheckbox = doc.createElement("input");
  focusCheckbox.type = "checkbox";
  focusCheckbox.dataset.action = "toggle-augment-focus";
  focusCheckbox.style.cursor = "pointer";

  const focusText = doc.createElement("span");
  focusText.textContent = "Focus while rep-farming";

  focusLabel.append(focusCheckbox, focusText);
  wrap.appendChild(focusLabel);

  return { wrap, checkboxes, repCheckbox, focusCheckbox };
}

// --- Config getter ---

export function getAugmentConfig(service) {
  return {
    categories: {
      hacking:     service.categories?.hacking     ?? true,
      combat:      service.categories?.combat      ?? true,
      hacknet:     service.categories?.hacknet     ?? false,
      bladeburner: service.categories?.bladeburner ?? false,
      charisma:    service.categories?.charisma    ?? false,
    },
    minMoneyBuffer: service.minMoneyBuffer ?? 0,
    repFarming: service.repFarming ?? false,
    focus: service.focus ?? false,
  };
}

// --- Details builder ---

export function buildAugmentDetails(ns, enabled, running, override, scriptExists, augConfig) {
  const CAT_LABELS = {
    hacking: "Hack", combat: "Combat", hacknet: "HN",
    bladeburner: "BB", charisma: "CHA",
  };
  const activeCats = Object.entries(augConfig.categories)
    .filter(([, on]) => on)
    .map(([k]) => CAT_LABELS[k] || k)
    .join(", ");

  const bufferText = augConfig.minMoneyBuffer > 0
    ? `Buffer: ${ns.formatNumber(augConfig.minMoneyBuffer)}$`
    : "No money buffer";

  return [
    `Config: ${enabled ? "ON" : "OFF"} | Runtime: ${running ? "RUNNING" : "STOPPED"} | ${scriptExists ? "Script: OK" : "Script: MISSING"}`,
    `Categories: ${activeCats || "none"}`,
    `Rep-Farming: ${augConfig.repFarming ? "ON" : "OFF"} | Focus: ${augConfig.focus ? "ON" : "OFF"} | ${bufferText}`,
  ].join("\n");
}

// --- Controls sync ---

export function syncAugmentControls(row, augmentConfig) {
  if (!row.augmentControls) return;
  for (const [cat, checkbox] of row.augmentControls.checkboxes) {
    checkbox.checked = augmentConfig.categories[cat] ?? false;
  }
  if (row.augmentControls.repCheckbox) {
    row.augmentControls.repCheckbox.checked = augmentConfig.repFarming;
  }
  if (row.augmentControls.focusCheckbox) {
    row.augmentControls.focusCheckbox.checked = augmentConfig.focus;
  }
}

// --- Action handler ---

export function handleAugmentAction(ns, action) {
  if (action.startsWith("toggle-augment-cat:")) {
    const cat = action.split(":")[1];
    toggleAugmentCategory(ns, cat);
    return true;
  }

  if (action === "toggle-augment-rep-farming") { toggleAugmentRepFarming(ns); return true; }
  if (action === "toggle-augment-focus") { toggleAugmentFocus(ns); return true; }
  return false;
}

// --- Private toggle helpers ---

function toggleAugmentCategory(ns, cat) {
  const VALID = ["hacking", "combat", "hacknet", "bladeburner", "charisma"];
  if (!VALID.includes(cat)) return;

  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.augments || {};
  const aug = getAugmentConfig(current);

  aug.categories[cat] = !aug.categories[cat];

  config.services.augments = {
    ...current,
    categories: aug.categories,
  };
  saveConfig(ns, CONFIG_FILE, config);
}

function toggleAugmentRepFarming(ns) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.augments || {};
  config.services.augments = {
    ...current,
    repFarming: !(current.repFarming ?? false),
  };
  saveConfig(ns, CONFIG_FILE, config);
}

function toggleAugmentFocus(ns) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.augments || {};
  config.services.augments = {
    ...current,
    focus: !(current.focus ?? false),
  };
  saveConfig(ns, CONFIG_FILE, config);
}
