import { makeButton, styleActionButton, RAM_OPTIONS, BUY_RAM_DEFAULT, UPGRADE_RAM_DEFAULT } from "./manager_gui_utils.js";

const NEW_SERVER_BUY_SCRIPT = "new_server_buy.js";
const UPGRADE_SERVER_SCRIPT = "upgrade_Server.js";

// --- DOM builder ---

export function buildServerAdminSection(doc) {
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

  const autoUpgradeCheckbox = makeAutoCheckbox("toggle-auto-upgrade-server", "Auto-Upgrade: upgrade servers when there is enough money");
  const autoBuyCheckbox     = makeAutoCheckbox("toggle-auto-buy-server",     "Auto-Buy: buy new servers when there is enough money");

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

// --- Render ---

export function renderServerTab(ns, panel) {
  const purchasedServers = ns.getPurchasedServers();
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
  const stepUpgradePlan = getStepUpgradePlan(ns, purchasedServers, upgradeRam);

  const autoUpgradeEnabled = panel.admin.autoUpgradeCheckbox.checked;
  if (autoUpgradeEnabled && buyScriptExists && !buyRunning
      && stepUpgradePlan.upgradableCount > 0 && stepUpgradePlan.minStepCost > 0
      && playerMoney >= stepUpgradePlan.minStepCost) {
    startScriptIfIdle(ns, NEW_SERVER_BUY_SCRIPT, upgradeRam, true);
  }

  const autoBuyEnabled = panel.admin.autoBuyCheckbox.checked;
  const autoBuyRam = RAM_OPTIONS[0];
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
  panel.admin.confirmText.textContent = `Upgrade ${upgradePlan.upgradableCount}/${purchasedServers.length} servers to ${ns.formatRam(upgradeRam)} for a total of ${ns.formatNumber(upgradePlan.totalCost)}$. ${upgradePlan.blockedDowngrades > 0 ? `${upgradePlan.blockedDowngrades} larger servers remain unchanged.` : ""}`.trim();
  panel.admin.details.textContent = [
    `MyServer: ${purchasedServers.length}/${purchasedLimit} | Money: ${ns.formatNumber(playerMoney)}$`,
    `Buy ${ns.formatRam(buyRam)} -> ${buyPlan.targetName} | Cost: ${ns.formatNumber(buyPlan.cost)}$ | ${buyPlan.status}`,
    `Upgrade ${ns.formatRam(upgradeRam)} -> ${upgradePlan.upgradableCount}/${purchasedServers.length} servers | Cost: ${ns.formatNumber(upgradePlan.totalCost)}$ | ${upgradePlan.status}`,
    `Buy Script: ${buyScriptExists ? (buyRunning ? "RUNNING" : "READY") : "MISSING"} | Upgrade Script: ${upgradeScriptExists ? (upgradeRunning ? "RUNNING" : "READY") : "MISSING"}`,
  ].join("\n");
}

// --- Action handler ---

export function handleServerAction(ns, panel, action) {
  if (action === "reset-upgrade-confirmation") { panel.admin.upgradePending = false; return true; }

  if (action === "buy-server") {
    panel.admin.upgradePending = false;
    startScriptIfIdle(ns, NEW_SERVER_BUY_SCRIPT, getSelectedRam(panel.admin.buyRamSelect, BUY_RAM_DEFAULT));
    return true;
  }

  if (action === "request-upgrade-server") { panel.admin.upgradePending = true; return true; }
  if (action === "cancel-upgrade-server") { panel.admin.upgradePending = false; return true; }

  if (action === "confirm-upgrade-server") {
    startScriptIfIdle(ns, UPGRADE_SERVER_SCRIPT, getSelectedRam(panel.admin.upgradeRamSelect, UPGRADE_RAM_DEFAULT), true);
    panel.admin.upgradePending = false;
    return true;
  }

  return false;
}

// --- Exported utility ---

export function getSelectedRam(select, fallback) {
  const numeric = Number(select?.value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

// --- Private helpers ---

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

function getBuyPlan(ns, purchasedServers, purchasedLimit, ram) {
  const index = purchasedServers.length;
  const targetName = `MyServer_${index}`;
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

function getStepUpgradePlan(ns, purchasedServers, targetRam) {
  let minStepCost = Infinity;
  let upgradableCount = 0;

  for (const server of purchasedServers) {
    const currentRam = ns.getServerMaxRam(server);
    if (currentRam >= targetRam) continue;
    const nextRam = currentRam * 2;
    if (nextRam > targetRam) continue;
    const cost = ns.getPurchasedServerUpgradeCost(server, nextRam);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    upgradableCount++;
    if (cost < minStepCost) minStepCost = cost;
  }

  return {
    upgradableCount,
    minStepCost: upgradableCount > 0 ? minStepCost : 0,
  };
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

function startScriptIfIdle(ns, script, ...args) {
  if (!ns.fileExists(script, "home")) {
    return;
  }

  if (ns.scriptRunning(script, "home")) {
    return;
  }

  ns.exec(script, "home", 1, ...args);
}
