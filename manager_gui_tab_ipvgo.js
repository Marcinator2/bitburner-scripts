import { loadConfig, saveConfig, CONFIG_FILE } from "./manager_gui_utils.js";

const OPPONENTS  = ["Slum Snakes", "Netburners", "The Black Hand", "Tetrads", "Illuminati"];
const BOARD_SIZES = [5, 7, 9, 13];

// --- DOM builder ---

export function buildIpvgoControls(doc) {
  const wrap = doc.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gridTemplateColumns = "1fr 1fr";
  wrap.style.gap = "6px 10px";
  wrap.style.marginTop = "10px";
  wrap.style.fontSize = "11px";
  wrap.style.color = "#c6d8eb";

  const makeLabel = (text) => {
    const el = doc.createElement("div");
    el.textContent = text;
    el.style.marginBottom = "2px";
    return el;
  };

  const makeSelect = (options, dataAction) => {
    const sel = doc.createElement("select");
    sel.dataset.action = dataAction;
    sel.style.width = "100%";
    sel.style.background = "#1a2535";
    sel.style.color = "#c6d8eb";
    sel.style.border = "1px solid rgba(100,160,220,0.3)";
    sel.style.borderRadius = "4px";
    sel.style.padding = "3px 5px";
    sel.style.fontSize = "11px";
    for (const opt of options) {
      const o = doc.createElement("option");
      o.value = String(opt);
      o.textContent = String(opt);
      sel.appendChild(o);
    }
    return sel;
  };

  const opponentLabel = makeLabel("Opponent");
  const opponentSelect = makeSelect(OPPONENTS, `set-ipvgo-opponent`);
  const boardLabel = makeLabel("Board Size");
  const boardSizeSelect = makeSelect(BOARD_SIZES, `set-ipvgo-boardsize`);

  const opponentWrap = doc.createElement("div");
  opponentWrap.append(opponentLabel, opponentSelect);
  const boardWrap = doc.createElement("div");
  boardWrap.append(boardLabel, boardSizeSelect);

  wrap.append(opponentWrap, boardWrap);
  return { wrap, opponentSelect, boardSizeSelect };
}

// --- Config getter ---

export function getIpvgoConfig(service) {
  const opponent = OPPONENTS.includes(service.opponent) ? service.opponent : "Slum Snakes";
  const boardSize = BOARD_SIZES.includes(Number(service.boardSize)) ? Number(service.boardSize) : 7;
  return { opponent, boardSize };
}

// --- Details builder ---

export function buildIpvgoDetails(enabled, running, override, scriptExists, ipvgoConfig) {
  return [
    `Config: ${enabled ? "ON" : "OFF"} | Runtime: ${running ? "RUNNING" : "STOPPED"} | ${scriptExists ? "Script: OK" : "Script: MISSING"}`,
    `Opponent: ${ipvgoConfig.opponent} | Board: ${ipvgoConfig.boardSize}x${ipvgoConfig.boardSize}`,
  ].join("\n");
}

// --- Controls sync ---

export function syncIpvgoControls(row, ipvgoConfig) {
  if (!row.ipvgoControls) return;
  const opSel = row.ipvgoControls.opponentSelect;
  const szSel = row.ipvgoControls.boardSizeSelect;
  const active = opSel.ownerDocument.activeElement;
  if (active !== opSel) opSel.value = ipvgoConfig.opponent;
  if (active !== szSel) szSel.value = String(ipvgoConfig.boardSize);
}

// --- Action handler ---

export function handleIpvgoAction(ns, action) {
  if (action.startsWith("set-ipvgo-opponent:")) {
    setIpvgoOpponent(ns, action.split(":")[1]);
    return true;
  }

  if (action.startsWith("set-ipvgo-boardsize:")) {
    setIpvgoBoardSize(ns, Number(action.split(":")[1]));
    return true;
  }

  return false;
}

// --- Private helpers ---

function setIpvgoOpponent(ns, opponent) {
  const config  = loadConfig(ns, CONFIG_FILE);
  const current = config.services.ipvgo || {};
  const ipvgo   = getIpvgoConfig(current);
  config.services.ipvgo = { ...current, opponent, args: [opponent, ipvgo.boardSize] };
  saveConfig(ns, CONFIG_FILE, config);
  ns.print(`[IPvGO] Opponent set to: ${opponent}`);
}

function setIpvgoBoardSize(ns, boardSize) {
  const config  = loadConfig(ns, CONFIG_FILE);
  const current = config.services.ipvgo || {};
  const ipvgo   = getIpvgoConfig(current);
  config.services.ipvgo = { ...current, boardSize, args: [ipvgo.opponent, boardSize] };
  saveConfig(ns, CONFIG_FILE, config);
  ns.print(`[IPvGO] Board size set to: ${boardSize}`);
}
