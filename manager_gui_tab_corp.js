import { loadConfig, saveConfig, CONFIG_FILE } from "./manager_gui_utils.js";
import { getCorpStatus } from "./manager_corporation.js";

// --- DOM builder ---

export function buildCorpControls(doc) {
  const wrap = doc.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gridTemplateColumns = "minmax(0, 1fr)";
  wrap.style.gap = "6px";
  wrap.style.marginTop = "10px";
  wrap.style.fontSize = "11px";
  wrap.style.color = "#c6d8eb";

  const checkboxes = new Map();
  const options = [
    { key: "autoInvest",   action: "toggle-corp-auto-invest",    label: "Auto-Invest: Investitionsangebote automatisch akzeptieren" },
    { key: "autoGoPublic", action: "toggle-corp-auto-go-public", label: "Auto-IPO: Automatisch an die Börse gehen" },
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

export function getCorpConfig(service) {
  return {
    autoInvest: service.autoInvest ?? false,
    autoGoPublic: service.autoGoPublic ?? false,
  };
}

// --- Details builder ---

export function buildCorpDetails(ns, enabled, running, override, scriptExists) {
  const status = getCorpStatus(ns);
  if (!status) {
    return [
      `Config: ${enabled ? "ON" : "OFF"} | Runtime: ${running ? "RUNNING" : "STOPPED"} | ${scriptExists ? "Script: OK" : "Script: MISSING"}`,
      "Keine Corporation vorhanden.",
    ].join("\n");
  }

  const profit = status.profit;
  const profitStr = profit >= 0 ? `+${ns.formatNumber(profit)}` : ns.formatNumber(profit);

  const lines = [
    `Config: ${enabled ? "ON" : "OFF"} | Runtime: ${running ? "RUNNING" : "STOPPED"} | ${scriptExists ? "Script: OK" : "Script: MISSING"}`,
    `${status.name} | Phase: ${status.phase} | ${status.public ? "PUBLIC" : "PRIVAT"}`,
    `Funds: ${ns.formatNumber(status.funds)}$ | Wert: ${ns.formatNumber(status.valuation)}$`,
    `Revenue: ${ns.formatNumber(status.revenue)}$/s | Profit: ${profitStr}$/s`,
    `Divisions: ${status.divisions}`,
  ];

  if (!status.public && status.investOffer > 0) {
    lines.push(`Invest-Runde ${status.investRound}: ${ns.formatNumber(status.investOffer)}$ angeboten`);
  }

  return lines.join("\n");
}

// --- Controls sync ---

export function syncCorpControls(row, override) {
  if (!row.corpControls) return;
  const corpConfig = getCorpConfig(override);
  row.corpControls.checkboxes.get("autoInvest").checked = corpConfig.autoInvest;
  row.corpControls.checkboxes.get("autoGoPublic").checked = corpConfig.autoGoPublic;
}

// --- Action handler ---

export function handleCorpAction(ns, action) {
  if (action === "toggle-corp-auto-invest") { toggleCorpAutoInvest(ns); return true; }
  if (action === "toggle-corp-auto-go-public") { toggleCorpAutoGoPublic(ns); return true; }
  return false;
}

// --- Private toggle helpers ---

function toggleCorpAutoInvest(ns) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.corporation || {};
  config.services.corporation = {
    ...current,
    autoInvest: !(current.autoInvest ?? false),
  };
  saveConfig(ns, CONFIG_FILE, config);
}

function toggleCorpAutoGoPublic(ns) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.corporation || {};
  config.services.corporation = {
    ...current,
    autoGoPublic: !(current.autoGoPublic ?? false),
  };
  saveConfig(ns, CONFIG_FILE, config);
}
