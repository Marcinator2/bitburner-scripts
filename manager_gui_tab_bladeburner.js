// --- DOM builder ---

export function buildBladeburnerPane(doc) {
  const wrap = doc.createElement("div");
  wrap.style.padding = "0 12px 12px";

  const infoList = doc.createElement("div");
  infoList.style.fontSize = "11px";
  infoList.style.color = "#b9d1e7";

  wrap.appendChild(infoList);
  return { wrap, infoList };
}

// --- Render ---

export function renderBladeburnerPane(ns, panel) {
  const doc = panel.root.ownerDocument;
  const { infoList } = panel.bladeburner;

  while (infoList.firstChild) infoList.removeChild(infoList.firstChild);

  if (!ns.bladeburner) {
    infoList.textContent = "Bladeburner API not available.";
    return;
  }

  if (!ns.bladeburner.inBladeburner()) {
    infoList.textContent = "Not enrolled in Bladeburner.";
    return;
  }

  const rank = ns.bladeburner.getRank();
  const skillPoints = ns.bladeburner.getSkillPoints();
  const [curStamina, maxStamina] = ns.bladeburner.getStamina();
  const city = ns.bladeburner.getCity();
  const currentAction = ns.bladeburner.getCurrentAction();
  const bonusTime = ns.bladeburner.getBonusTime();

  const bonusSec = Math.floor(bonusTime / 1000);
  const bonusMin = Math.floor(bonusSec / 60);
  const bonusHours = Math.floor(bonusMin / 60);
  const bonusTimeStr = bonusHours > 0
    ? `${bonusHours}h ${bonusMin % 60}m ${bonusSec % 60}s`
    : bonusMin > 0
      ? `${bonusMin}m ${bonusSec % 60}s`
      : `${bonusSec}s`;

  function makeCard(text) {
    const card = doc.createElement("div");
    card.style.padding = "8px";
    card.style.border = "1px solid rgba(255,255,255,0.08)";
    card.style.borderRadius = "8px";
    card.style.background = "rgba(255,255,255,0.02)";
    card.style.marginBottom = "8px";
    card.style.whiteSpace = "pre-line";
    card.textContent = text;
    return card;
  }

  infoList.appendChild(makeCard([
    `Rank: ${ns.formatNumber(rank, 2)} | Skill Points: ${skillPoints}`,
    `Stamina: ${curStamina.toFixed(2)} / ${maxStamina.toFixed(2)}`,
    `Bonus Time: ${bonusTimeStr}`,
  ].join("\n")));

  let actionText = "Action: Idle";
  if (currentAction && currentAction.type !== "Idle") {
    let successText = "";
    if (typeof ns.bladeburner.getActionSuccessChance === "function") {
      const chance = ns.bladeburner.getActionSuccessChance(currentAction.type, currentAction.name);
      if (Array.isArray(chance)) {
        successText = ` | ${(chance[0] * 100).toFixed(1)}%-${(chance[1] * 100).toFixed(1)}%`;
      } else if (typeof chance === "number") {
        successText = ` | ${(chance * 100).toFixed(1)}%`;
      }
    }
    actionText = `Action: ${currentAction.type} / ${currentAction.name}${successText}`;
  }
  infoList.appendChild(makeCard(actionText));

  const pop = ns.bladeburner.getCityEstimatedPopulation(city);
  const chaos = ns.bladeburner.getCityChaos(city);
  infoList.appendChild(makeCard(`City: ${city}\nEst. Pop: ${ns.formatNumber(pop)} | Chaos: ${chaos.toFixed(2)}`));

  const citiesTitle = doc.createElement("div");
  citiesTitle.textContent = "City Overview";
  citiesTitle.style.fontSize = "12px";
  citiesTitle.style.fontWeight = "700";
  citiesTitle.style.marginBottom = "4px";
  citiesTitle.style.color = "#9fc0de";
  infoList.appendChild(citiesTitle);

  const CITIES = ["Aevum", "Chongqing", "Ishima", "New Tokyo", "Sector-12", "Volhaven"];
  for (const c of CITIES) {
    const row = doc.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.padding = "3px 0";
    row.style.borderBottom = "1px solid rgba(255,255,255,0.06)";

    const isCurrentCity = c === city;
    const nameEl = doc.createElement("div");
    nameEl.textContent = isCurrentCity ? `► ${c}` : c;
    nameEl.style.color = isCurrentCity ? "#e5eef7" : "#8db3d9";
    nameEl.style.fontWeight = isCurrentCity ? "700" : "400";

    const statsEl = doc.createElement("div");
    statsEl.style.color = "#9fc0de";
    const cityPop = ns.bladeburner.getCityEstimatedPopulation(c);
    const cityChaos = ns.bladeburner.getCityChaos(c);
    statsEl.textContent = `Pop: ${ns.formatNumber(cityPop)} | Chaos: ${cityChaos.toFixed(1)}`;

    row.append(nameEl, statsEl);
    infoList.appendChild(row);
  }
}
