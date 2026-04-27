import { makeButton, styleActionButton } from "./manager_gui_utils.js";

// --- DOM builder ---

export function buildInfiltratePane(doc) {
  const wrap = doc.createElement("div");

  const diffRow = doc.createElement("div");
  diffRow.style.display = "flex";
  diffRow.style.flexWrap = "wrap";
  diffRow.style.gap = "6px";
  diffRow.style.alignItems = "center";
  diffRow.style.marginBottom = "10px";

  const diffLabel = doc.createElement("div");
  diffLabel.textContent = "Difficulty:";
  diffLabel.style.fontSize = "12px";
  diffLabel.style.color = "#9fc0de";
  diffLabel.style.whiteSpace = "nowrap";

  const diffInput = doc.createElement("input");
  diffInput.type = "number";
  diffInput.step = "0.1";
  diffInput.min = "0";
  diffInput.max = "10";
  diffInput.value = "1.5";
  diffInput.style.width = "62px";
  diffInput.style.background = "#1a2535";
  diffInput.style.color = "#c6d8eb";
  diffInput.style.border = "1px solid rgba(100,160,220,0.3)";
  diffInput.style.borderRadius = "4px";
  diffInput.style.padding = "4px 6px";
  diffInput.style.fontSize = "12px";
  diffInput.style.font = "inherit";

  diffRow.append(diffLabel, diffInput);

  for (const preset of [{ label: "Easy", value: 1.0 }, { label: "Med", value: 2.0 }, { label: "Hard", value: 3.0 }]) {
    const btn = makeButton(doc, preset.label, `set-infiltrate-diff:${preset.value}`);
    btn.style.padding = "4px 8px";
    btn.style.fontSize = "11px";
    styleActionButton(btn, "neutral");
    diffRow.appendChild(btn);
  }

  const resultsList = doc.createElement("div");
  resultsList.style.fontSize = "11px";
  resultsList.style.color = "#b9d1e7";

  wrap.append(diffRow, resultsList);
  return { wrap, diffInput, diffRow, resultsList };
}

// --- Render ---

export function renderInfiltratePane(ns, panel) {
  const doc = panel.root.ownerDocument;
  const { diffInput, resultsList } = panel.infiltrate;

  const targetDiff = parseFloat(diffInput.value) || 1.5;

  const hasFullApi = typeof ns.infiltration?.getInfiltrations === "function";
  const hasPossible = typeof ns.infiltration?.getPossibleLocations === "function";

  panel.infiltrate.diffRow.style.display = hasFullApi ? "flex" : "none";

  while (resultsList.firstChild) resultsList.removeChild(resultsList.firstChild);

  if (hasFullApi) {
    let locations;
    try {
      locations = ns.infiltration.getInfiltrations();
    } catch (e) {
      resultsList.textContent = `Infiltration API error: ${e?.message ?? e}`;
      return;
    }

    if (!locations || locations.length === 0) {
      resultsList.textContent = "No infiltration locations found.";
      return;
    }

    const sorted = [...locations].sort(
      (a, b) => Math.abs(a.difficulty - targetDiff) - Math.abs(b.difficulty - targetDiff)
    );

    const hasSf4 = Boolean(ns.singularity);

    for (const loc of sorted.slice(0, 7)) {
      const row = doc.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.gap = "6px";
      row.style.padding = "5px 0";
      row.style.borderBottom = "1px solid rgba(255,255,255,0.06)";

      const info = doc.createElement("div");
      info.style.flex = "1";
      info.style.minWidth = "0";

      const nameLine = doc.createElement("div");
      nameLine.textContent = loc.location.name;
      nameLine.style.fontSize = "12px";
      nameLine.style.fontWeight = "700";
      nameLine.style.color = "#e5eef7";
      nameLine.style.overflow = "hidden";
      nameLine.style.textOverflow = "ellipsis";
      nameLine.style.whiteSpace = "nowrap";

      const statsLine = doc.createElement("div");
      statsLine.textContent = `${loc.location.city} | Diff: ${loc.difficulty.toFixed(2)} | $${ns.formatNumber(loc.reward.sellCash)} | Rep: ${ns.formatNumber(loc.reward.tradeRep)}`;
      statsLine.style.fontSize = "10px";
      statsLine.style.color = "#8db3d9";
      statsLine.style.marginTop = "1px";

      info.append(nameLine, statsLine);

      const btn = makeButton(doc, "Go To", `go-to-infiltrate:${loc.location.name}|${loc.location.city}`);
      btn.style.padding = "4px 8px";
      btn.style.fontSize = "11px";
      btn.disabled = !hasSf4;
      styleActionButton(btn, hasSf4 ? "start" : "disabled");

      row.append(info, btn);
      resultsList.appendChild(row);
    }

    if (!hasSf4) {
      const note = doc.createElement("div");
      note.textContent = "SF4 required for auto-navigation.";
      note.style.marginTop = "6px";
      note.style.fontSize = "10px";
      note.style.color = "#7fa6c8";
      resultsList.appendChild(note);
    }
  } else if (hasPossible) {
    const hint = doc.createElement("div");
    hint.textContent = "Difficulty/reward data not available in this BitNode. Showing all locations.";
    hint.style.fontSize = "10px";
    hint.style.color = "#8db3d9";
    hint.style.marginBottom = "8px";
    resultsList.appendChild(hint);

    let locations;
    try {
      locations = ns.infiltration.getPossibleLocations();
    } catch (e) {
      const err = doc.createElement("div");
      err.textContent = `Error: ${e?.message ?? e}`;
      resultsList.appendChild(err);
      return;
    }

    const hasSf4 = Boolean(ns.singularity);
    for (const loc of (locations ?? [])) {
      const row = doc.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.gap = "6px";
      row.style.padding = "5px 0";
      row.style.borderBottom = "1px solid rgba(255,255,255,0.06)";

      const info = doc.createElement("div");
      info.style.flex = "1";
      info.style.minWidth = "0";

      const nameLine = doc.createElement("div");
      nameLine.textContent = loc.name;
      nameLine.style.fontSize = "12px";
      nameLine.style.fontWeight = "700";
      nameLine.style.color = "#e5eef7";
      nameLine.style.overflow = "hidden";
      nameLine.style.textOverflow = "ellipsis";
      nameLine.style.whiteSpace = "nowrap";

      const cityLine = doc.createElement("div");
      cityLine.textContent = loc.city;
      cityLine.style.fontSize = "10px";
      cityLine.style.color = "#8db3d9";
      cityLine.style.marginTop = "1px";

      info.append(nameLine, cityLine);

      const btn = makeButton(doc, "Go To", `go-to-infiltrate:${loc.name}|${loc.city}`);
      btn.style.padding = "4px 8px";
      btn.style.fontSize = "11px";
      btn.disabled = !hasSf4;
      styleActionButton(btn, hasSf4 ? "start" : "disabled");

      row.append(info, btn);
      resultsList.appendChild(row);
    }
  } else {
    resultsList.textContent = "Infiltration API not available in this BitNode.";
  }
}

// --- Action handler ---

export function handleInfiltrateAction(ns, panel, action) {
  if (action.startsWith("set-infiltrate-diff:")) {
    const val = parseFloat(action.split(":")[1]);
    if (!isNaN(val) && panel.infiltrate) {
      panel.infiltrate.diffInput.value = String(val);
    }
    return true;
  }

  if (action.startsWith("go-to-infiltrate:")) {
    const payload = action.slice("go-to-infiltrate:".length);
    const sepIdx = payload.indexOf("|");
    const name = sepIdx >= 0 ? payload.slice(0, sepIdx) : payload;
    const city = sepIdx >= 0 ? payload.slice(sepIdx + 1) : null;
    if (name && ns.singularity) {
      try {
        if (city) ns.singularity.travelToCity(city);
        const ok = ns.singularity.goToLocation(name);
        if (!ok) ns.tprint(`[Infiltrate] Could not navigate to: ${name}`);
      } catch (e) {
        ns.tprint(`[Infiltrate] Navigation failed: ${e}`);
      }
    } else if (!ns.singularity) {
      ns.tprint("[Infiltrate] SF4 required to navigate automatically.");
    }
    return true;
  }

  return false;
}
