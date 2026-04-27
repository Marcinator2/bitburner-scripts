import { ensureJsonFile } from "./runtime_file_utils.js";

export const CONFIG_FILE = "main_manager_config.js";
export const RAM_OPTIONS = [8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576];
export const BUY_RAM_DEFAULT = 2 ** 16;
export const UPGRADE_RAM_DEFAULT = 2 ** 12;

export function makeButton(doc, text, action) {
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

export function styleActionButton(button, mode) {
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

export function loadConfig(ns, configFile) {
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

export function saveConfig(ns, configFile, config) {
  ns.write(configFile, JSON.stringify(config, null, 2), "w");
}
