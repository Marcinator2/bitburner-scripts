import { loadConfig, saveConfig, CONFIG_FILE } from "./manager_gui_utils.js";

// --- DOM builders (for extra controls in services tab compact rows) ---

export function buildHackControls(doc) {
  const wrap = doc.createElement("div");
  wrap.style.marginTop = "8px";
  wrap.style.fontSize = "11px";
  wrap.style.color = "#c6d8eb";

  const shareLabel = doc.createElement("label");
  shareLabel.style.display = "flex";
  shareLabel.style.alignItems = "center";
  shareLabel.style.gap = "6px";
  shareLabel.style.cursor = "pointer";

  const shareCheckbox = doc.createElement("input");
  shareCheckbox.type = "checkbox";
  shareCheckbox.dataset.action = "toggle-hack-share-ram";
  shareCheckbox.style.cursor = "pointer";

  const shareText = doc.createElement("span");
  shareText.textContent = "Enable share-ram on runners";

  shareLabel.append(shareCheckbox, shareText);
  wrap.appendChild(shareLabel);

  return { wrap, shareCheckbox };
}

export function buildHacknetControls(doc) {
  const wrap = doc.createElement("div");
  wrap.style.marginTop = "8px";
  wrap.style.fontSize = "11px";
  wrap.style.color = "#c6d8eb";

  const roiLabel = doc.createElement("label");
  roiLabel.style.display = "flex";
  roiLabel.style.alignItems = "center";
  roiLabel.style.gap = "6px";
  roiLabel.style.cursor = "pointer";

  const roiCheckbox = doc.createElement("input");
  roiCheckbox.type = "checkbox";
  roiCheckbox.dataset.action = "toggle-hacknet-roi";
  roiCheckbox.style.cursor = "pointer";

  const roiText = doc.createElement("span");
  roiText.textContent = "Wait for ROI before upgrading";

  roiLabel.append(roiCheckbox, roiText);
  wrap.appendChild(roiLabel);

  return { wrap, roiCheckbox };
}

export function buildProgramsControls(doc) {
  const wrap = doc.createElement("div");
  wrap.style.marginTop = "8px";
  wrap.style.fontSize = "11px";
  wrap.style.color = "#c6d8eb";

  const studyLabel = doc.createElement("label");
  studyLabel.style.display = "flex";
  studyLabel.style.alignItems = "center";
  studyLabel.style.gap = "6px";
  studyLabel.style.cursor = "pointer";

  const studyCheckbox = doc.createElement("input");
  studyCheckbox.type = "checkbox";
  studyCheckbox.dataset.action = "toggle-programs-build";
  studyCheckbox.style.cursor = "pointer";

  const studyText = doc.createElement("span");
  studyText.textContent = "Build program when can't buy";

  studyLabel.append(studyCheckbox, studyText);
  wrap.appendChild(studyLabel);

  return { wrap, studyCheckbox };
}

// --- Config getter ---

export function getProgramsConfig(service) {
  return {
    build: service.build ?? false,
  };
}

// --- Controls sync ---

export function syncHackControls(row, hackService) {
  if (!row.hackControls) return;
  row.hackControls.shareCheckbox.checked = !!(hackService.shareRam ?? true);
}

export function syncHacknetControls(row, hacknetService) {
  if (!row.hacknetControls) return;
  row.hacknetControls.roiCheckbox.checked = !!(hacknetService.requireRoi);
}

export function syncProgramsControls(row, programsService) {
  if (!row.programsControls?.studyCheckbox) return;
  const cfg = getProgramsConfig(programsService);
  row.programsControls.studyCheckbox.checked = cfg.build;
}

// --- Action handler ---

export function handleServicesAction(ns, action) {
  if (action === "toggle-hack-share-ram") { toggleHackShareRam(ns); return true; }
  if (action === "toggle-hacknet-roi") { toggleHacknetRoi(ns); return true; }
  if (action === "toggle-programs-build") { toggleProgramsBuild(ns); return true; }
  return false;
}

// --- Private toggle helpers ---

function toggleHackShareRam(ns) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.hack || {};
  config.services.hack = {
    ...current,
    shareRam: !(current.shareRam ?? true),
  };
  saveConfig(ns, CONFIG_FILE, config);
}

function toggleHacknetRoi(ns) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.hacknet || {};
  config.services.hacknet = {
    ...current,
    requireRoi: !(current.requireRoi ?? false),
  };
  saveConfig(ns, CONFIG_FILE, config);
}

function toggleProgramsBuild(ns) {
  const config = loadConfig(ns, CONFIG_FILE);
  const current = config.services.programs || {};
  config.services.programs = {
    ...current,
    build: !(current.build ?? false),
  };
  saveConfig(ns, CONFIG_FILE, config);
}
