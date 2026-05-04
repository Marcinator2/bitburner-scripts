/** @param {NS} ns */

// Corporation Manager - fully automatic
// Phases: Setup → Investment Rounds 1+2 → Public → Endgame (MarketTA.II + Products)
//
// Strategy:
//   1. Ensure Warehouse & Office API are unlocked
//   2. Create Tobacco Division + expand to all 6 cities (Tobacco is best early industry)
//   3. Upgrade offices, hire employees, enable Smart Supply
//   4. Maximize corp upgrades until investment round 1 (target: ~200b offer)
//   5. Accept investment round 1, then round 2 (~1t offer)
//   6. Go public, unlock Market-TA.II
//   7. Create up to 3 products at once (depending on maxProducts)
//   8. Keep morale/energy high via tea & party

const CONFIG_FILE = "main_manager_config.js";
const LOOP_MS = 5000;

const CITIES = ["Aevum", "Chongqing", "Sector-12", "New Tokyo", "Ishima", "Volhaven"];
const TOBACCO_DIV = "Tobacco Division";
const AGRI_DIV = "Agriculture Division";

// Target funds for investment rounds
const INVEST_ROUND1_FUNDS_TARGET = 210e9;   // 210 billion
const INVEST_ROUND2_FUNDS_TARGET = 2e12;    // 2 trillion

// Office size per investment round
const OFFICE_SIZES = {
  early:  9,   // Before round 1
  round1: 30,  // After round 1
  round2: 60,  // After round 2
  late:   60,  // Endgame
};

// Product design/marketing investment
const PRODUCT_DESIGN_BUDGET_RATIO = 0.1;   // 10% of available funds for design
const PRODUCT_MARKETING_BUDGET_RATIO = 0.1; // 10% for marketing
const PRODUCT_MIN_INVEST = 1e9;             // At least 1 billion
const PRODUCT_MAX_INVEST = 1e12;            // Max 1 trillion

// Corp upgrades to keep high at all times
const CORP_UPGRADES = [
  "Smart Factories",
  "Smart Storage",
  "Wilson Analytics",
  "Nuoptimal Nootropic Injector Implants",
  "Speech Processor Implants",
  "Neural Accelerators",
  "FocusWires",
  "ABC SalesBots",
  "Project Insight",
  "DreamSense",
];

// Unlock list
const REQUIRED_UNLOCKS = [
  "Warehouse API",
  "Office API",
  "Smart Supply",
  "Market Research - Demand",
  "Market Data - Competition",
];

// Research to unlock as early as possible
const EARLY_RESEARCH = [
  "Hi-Tech R&D Laboratory",
];
const LATE_RESEARCH = [
  "Market-TA.I",
  "Market-TA.II",
  "uPgrade: Fulcrum",
  "uPgrade: Capacity.I",
  "uPgrade: Capacity.II",
  "Self-Correcting Assemblers",
  "Drones",
  "Drones - Assembly",
  "Drones - Transport",
  "AutoBrew",
  "AutoPartyManager",
  "Go-Juice",
  "HRBuddy-Recruitment",
  "HRBuddy-Training",
];

// All materials Agriculture buys for boost
const AGRI_INPUT_MATERIALS = ["Hardware", "Robots", "AI Cores", "Real Estate"];

// Boost amounts for Agriculture (for multipliers)
const AGRI_BOOST = {
  "Hardware":    12500,
  "Robots":      2500,
  "AI Cores":    25000,
  "Real Estate": 3e6,
};

// Boost amounts for Tobacco
const TOBACCO_BOOST = {
  "Hardware":    2800,
  "Robots":      96,
  "AI Cores":    2520,
  "Real Estate": 146400,
};

export async function main(ns) {
  ns.disableLog("ALL");

  const configFile = String(ns.args[0] || CONFIG_FILE);

  if (!ns.corporation || typeof ns.corporation.hasCorporation !== "function") {
    ns.tprint("ERROR: Corporation API nicht verfügbar.");
    return;
  }

  // --restart: guide user to restart the corp via the in-game UI
  // The NS API createCorporation() cannot replace an existing corporation —
  // restart is only available through the game UI.
  if (ns.args.includes("--restart")) {
    ns.tprint("INFO: The NS API cannot restart an existing corporation.");
    ns.tprint("INFO: To restart with self-fund ($150b from your wallet):");
    ns.tprint("INFO:   1. Open the Corporation tab in the game.");
    ns.tprint("INFO:   2. Click 'Overview' → find the 'Sell CEO position' or restart option.");
    ns.tprint("INFO:   3. Re-create the corporation and choose 'Use your own money' ($150b).");
    ns.tprint("INFO: You have enough money — $150b is negligible compared to your wallet.");
    return;
  }

  if (!ns.corporation.hasCorporation()) {
    ns.tprint("ERROR: Keine Corporation vorhanden. Bitte zuerst eine Corporation gründen.");
    return;
  }

  ns.print("Corporation Manager gestartet.");
  ns.ui.openTail(); // open own tail so WARN messages are visible

  let loopCount = 0;

  while (true) {
    try {
      const config = loadCorpConfig(ns, configFile);
      await runCorpLoop(ns, config, configFile, loopCount);
    } catch (e) {
      ns.print(`WARN: Fehler im Corp-Loop: ${e}`);
    }

    loopCount++;
    await ns.sleep(LOOP_MS);
  }
}

async function runCorpLoop(ns, config, configFile, loopCount) {
  const corp = ns.corporation;
  const corpInfo = corp.getCorporation();

  // 1. Divisions first — must exist before spending funds on unlocks
  //    (Unlocks cost $135b total, which would exhaust the $150b starting capital
  //    before Agriculture ($40b) could ever be created.)
  ensureDivisions(ns);

  // 1b. Bootstrap deadlock detection: warn when corp has insufficient funds for any division.
  //     This can happen if a previous run drained money on upgrades/unlocks before divisions
  //     were created. With only $2b (BN3 seed money), investment round offers (~$640m) are
  //     far too small to ever reach $20b for Tobacco. The only fix is a corp restart.
  {
    const freshInfo = corp.getCorporation();
    if (freshInfo.divisions.length === 0 && freshInfo.funds < 20e9) {
      if (loopCount % 12 === 0) {
        ns.print(`WARN: Corp is in a bootstrap deadlock: ${ns.format.number(freshInfo.funds)}$ — need $20b+ for the cheapest division.`);
        const offer = (() => { try { return corp.getInvestmentOffer(); } catch { return null; } })();
        if (offer && offer.round <= 4) {
          const tooSmall = offer.funds < 20e9;
          if (tooSmall) {
            ns.print(`WARN: Investment round ${offer.round} offer (${ns.format.number(offer.funds)}$) is too small to help — accepting won't reach $20b.`);
          }
        }
        ns.print(`ACTION: Go to the Corporation tab → Overview → sell/restart the corp → choose "Use your own money" ($150b from wallet).`);
      }
      return; // Nothing useful can be done — skip rest of loop
    }
  }

  // 2. Unlocks sicherstellen (with budget reserve so divisions/warehouses stay affordable)
  ensureUnlocks(ns);

  // 3. Warehouses + Offices sicherstellen
  const phase = determinePhase(ns, corpInfo);
  ensureInfrastructure(ns, phase);

  // 4. Smart Supply aktivieren
  enableSmartSupply(ns);

  // 4b. Required input materials kaufen wenn Smart Supply noch nicht verfügbar
  //     (sonst produziert Agriculture 0, da Water/Chemicals fehlen)
  ensureRequiredMaterials(ns);

  // 5. Mitarbeiter einstellen und Jobs zuweisen
  hireAndAssign(ns, phase);

  // 6. Corp-Upgrades kaufen (wenn Geld vorhanden)
  buyCorpUpgrades(ns, corpInfo, phase);

  // 7. Forschungen freischalten
  buyResearch(ns, phase);

  // 8. Morale / Energy hoch halten
  if (loopCount % 6 === 0) {
    maintainEmployeeStats(ns);
  }

  // 9. Investitionsangebote prüfen
  handleInvestment(ns, corpInfo, phase, configFile);

  // 10. Produkte verwalten
  manageProducts(ns, corpInfo, phase);

  // 11. Material-Sells setzen
  setSellOrders(ns, phase);

  // 12. AdVerts kaufen (Tobacco)
  buyAdVerts(ns, phase);

  // 13. Boost-Materialien kaufen
  if (loopCount % 3 === 0) {
    buyBoostMaterials(ns, phase);
  }
}

// ─── Phase-Bestimmung ─────────────────────────────────────────────────────────

function determinePhase(ns, corpInfo) {
  const round = corpInfo.investorShares > 0 ? 2 : 1;
  if (corpInfo.public) return "late";
  if (round === 2) return "round2";
  // Prüfe ob Invest-Runde 1 schon gemacht wurde: investorShares > 0 wäre round2, aber
  // wir unterscheiden anhand Funds: nach Runde 1 hat man deutlich mehr
  if (corpInfo.funds >= INVEST_ROUND1_FUNDS_TARGET) return "round2";
  return "early";
}

// ─── Required Input Materials (Smart Supply Fallback) ─────────────────────────

// When Smart Supply is not yet unlocked, manually set a continuous purchase
// rate for each division's required input materials so production is non-zero.
// Once Smart Supply is enabled it overrides these rates automatically.
function ensureRequiredMaterials(ns) {
  const corp = ns.corporation;
  if (corp.hasUnlock("Smart Supply")) return;
  if (!corp.hasUnlock("Warehouse API")) return;

  const corpInfo = corp.getCorporation();
  for (const divName of corpInfo.divisions) {
    try {
      const divInfo = corp.getDivision(divName);
      const industryData = corp.getIndustryData(divInfo.industry);
      const required = industryData.requiredMaterials ?? {};
      for (const city of divInfo.cities) {
        try {
          if (!corp.hasWarehouse(divName, city)) continue;
          for (const [material, rate] of Object.entries(required)) {
            try {
              corp.buyMaterial(divName, city, material, rate);
            } catch { /* */ }
          }
        } catch { /* */ }
      }
    } catch { /* */ }
  }
}

// ─── Unlocks ──────────────────────────────────────────────────────────────────

function ensureUnlocks(ns) {
  const corp = ns.corporation;

  // Warehouse API and Office API are hard prerequisites for hiring and warehouses.
  // Never buy one without being able to afford BOTH — otherwise the remaining $40b
  // gets spent on other unlocks/infrastructure and the second API can never be bought.
  const hasWarehouseAPI = corp.hasUnlock("Warehouse API");
  const hasOfficeAPI = corp.hasUnlock("Office API");

  if (!hasWarehouseAPI || !hasOfficeAPI) {
    const costNeeded = (!hasWarehouseAPI ? 50e9 : 0) + (!hasOfficeAPI ? 50e9 : 0);
    const info = corp.getCorporation();
    if (info.funds < costNeeded + 10e9) {
      // Not enough to buy all missing APIs + buffer — don't buy any yet
      ns.print(`INFO: Need ${ns.format.number(costNeeded + 10e9)}$ for APIs, have ${ns.format.number(info.funds)}$`);
      return;
    }
    if (!hasWarehouseAPI) { corp.purchaseUnlock("Warehouse API"); ns.print("Unlock purchased: Warehouse API"); }
    if (!hasOfficeAPI)    { corp.purchaseUnlock("Office API");    ns.print("Unlock purchased: Office API");    }
    return; // buy remaining unlocks next loop
  }

  // Both APIs owned — buy remaining unlocks with a small reserve
  const minReserve = 10e9;
  for (const unlock of REQUIRED_UNLOCKS) {
    if (unlock === "Warehouse API" || unlock === "Office API") continue;
    try {
      if (!corp.hasUnlock(unlock)) {
        const cost = corp.getUnlockCost(unlock);
        const info = corp.getCorporation();
        if (info.funds >= cost + minReserve) {
          corp.purchaseUnlock(unlock);
          ns.print(`Unlock purchased: ${unlock}`);
        }
      }
    } catch { }
  }
}

// ─── Divisions ────────────────────────────────────────────────────────────────

function ensureDivisions(ns) {
  const corp = ns.corporation;
  const corpInfo = corp.getCorporation();
  const divNames = corpInfo.divisions;

  if (!divNames.includes(AGRI_DIV)) {
    try {
      const info = corp.getCorporation();
      // Must be able to afford Agriculture ($40b) AND both APIs ($100b) + buffer ($10b)
      // = $150b total. Creating Agriculture with less means we can never buy both APIs.
      if (info.funds >= 150e9) {
        corp.expandIndustry("Agriculture", AGRI_DIV);
        ns.print(`Division created: ${AGRI_DIV}`);
      } else {
        ns.print(`INFO: Need $150b to create Agriculture (have ${ns.format.number(info.funds)}$)`);
      }
    } catch (e) {
      ns.print(`WARN: Could not create ${AGRI_DIV}: ${e}`);
    }
  }

  // Only create Tobacco after both APIs are unlocked — it would otherwise consume
  // funds needed for Office API / Warehouse API.
  if (!divNames.includes(TOBACCO_DIV)) {
    if (!corp.hasUnlock("Office API") || !corp.hasUnlock("Warehouse API")) return;
    try {
      const info = corp.getCorporation();
      if (info.funds >= 20e9) {
        corp.expandIndustry("Tobacco", TOBACCO_DIV);
        ns.print(`Division created: ${TOBACCO_DIV}`);
      }
    } catch (e) {
      ns.print(`WARN: Could not create ${TOBACCO_DIV}: ${e}`);
    }
  }
}

// ─── Infrastruktur ────────────────────────────────────────────────────────────

function ensureInfrastructure(ns, phase) {
  const corp = ns.corporation;
  const corpInfo = corp.getCorporation();
  const divNames = corpInfo.divisions;

  const targetOfficeSize = OFFICE_SIZES[phase] ?? OFFICE_SIZES.early;

  for (const div of divNames) {
    for (const city of CITIES) {
      // Erst in Stadt expandieren
      try {
        const divInfo = corp.getDivision(div);
        if (!divInfo.cities.includes(city)) {
          const info = corp.getCorporation();
          if (info.funds >= 4e9) {
            corp.expandCity(div, city);
            ns.print(`${div}: expandiert nach ${city}`);
          }
        }
      } catch { /* Stad existiert bereits */ }

      // Warehouse kaufen
      try {
        if (!corp.hasWarehouse(div, city)) {
          const info = corp.getCorporation();
          if (info.funds >= 5e6) {
            corp.purchaseWarehouse(div, city);
          }
        }
      } catch { /* bereits vorhanden */ }

      // Warehouse upgraden (Level anhand Phase)
      try {
        const warehouse = corp.getWarehouse(div, city);
        const targetLevel = phase === "early" ? 3 : phase === "round1" ? 10 : phase === "round2" ? 20 : 30;
        if (warehouse.level < targetLevel) {
          const upgrades = targetLevel - warehouse.level;
          const upgradeCost = corp.getUpgradeWarehouseCost(div, city, upgrades);
          const info = corp.getCorporation();
          if (info.funds >= upgradeCost) {
            corp.upgradeWarehouse(div, city, upgrades);
          }
        }
      } catch { /* */ }

      // Office upgraden
      try {
        const office = corp.getOffice(div, city);
        if (office.size < targetOfficeSize) {
          const delta = targetOfficeSize - office.size;
          const upgradeCost = corp.getOfficeSizeUpgradeCost(div, city, delta);
          const info = corp.getCorporation();
          if (info.funds >= upgradeCost) {
            corp.upgradeOfficeSize(div, city, delta);
          }
        }
      } catch { /* */ }
    }
  }
}

// ─── Smart Supply ─────────────────────────────────────────────────────────────

function enableSmartSupply(ns) {
  const corp = ns.corporation;
  if (!corp.hasUnlock("Smart Supply")) return;

  const corpInfo = corp.getCorporation();
  for (const div of corpInfo.divisions) {
    for (const city of CITIES) {
      try {
        const wh = corp.getWarehouse(div, city);
        if (!wh.smartSupplyEnabled) {
          corp.setSmartSupply(div, city, true);
        }
      } catch { /* */ }
    }
  }
}

// ─── Einstellen & Zuweisen ────────────────────────────────────────────────────

function hireAndAssign(ns, phase) {
  const corp = ns.corporation;
  const corpInfo = corp.getCorporation();

  const hasOfficeAPI = (() => { try { return corp.hasUnlock("Office API"); } catch { return false; } })();
  // Diagnostic: print state every loop to terminal so it's always visible
  const divSummary = corpInfo.divisions.map(d => {
    try {
      const o = corp.getOffice(d, "Sector-12");
      return `${d}:${o.numEmployees}/${o.size}`;
    } catch { return `${d}:?`; }
  }).join(", ");
  ns.tprint(`[corp] phase=${phase} officeAPI=${hasOfficeAPI} ${divSummary}`);

  if (!hasOfficeAPI) {
    ns.tprint(`[corp] BLOCKED: Office API not unlocked — cannot hire.`);
    return;
  }

  const jobRatio = phase === "early"
    ? { "Operations": 1, "Engineer": 2, "Business": 1, "Management": 1, "Research & Development": 4 }
    : phase === "round1"
      ? { "Operations": 6, "Engineer": 6, "Business": 6, "Management": 6, "Research & Development": 6 }
      : { "Operations": 6, "Engineer": 8, "Business": 8, "Management": 4, "Research & Development": 10 };

  for (const div of corpInfo.divisions) {
    for (const city of CITIES) {
      let office;
      try { office = corp.getOffice(div, city); } catch { continue; }

      // Hire all open slots
      const slotsToFill = office.size - office.numEmployees;
      if (slotsToFill > 0) {
        let hired = 0;
        for (let i = 0; i < slotsToFill; i++) {
          try {
            const ok = corp.hireEmployee(div, city);
            if (ok) { hired++; } else { break; }
          } catch (e) {
            ns.tprint(`WARN [corp/hire]: ${div}/${city}: ${e}`);
            break;
          }
        }
        if (hired > 0) {
          ns.print(`Hired ${hired} employees in ${div}/${city}`);
        } else {
          ns.tprint(`WARN [corp/hire]: 0 hired in ${div}/${city} (slots: ${slotsToFill}, size: ${office.size}, emp: ${office.numEmployees})`);
        }
        try { office = corp.getOffice(div, city); } catch { continue; }
      }

      // Assign jobs: Largest Remainder Method
      const n = office.numEmployees;
      if (n === 0) continue;
      const totalRatio = Object.values(jobRatio).reduce((a, b) => a + b, 0);
      const jobTargets = {};
      let assigned = 0;
      for (const [job, ratio] of Object.entries(jobRatio)) {
        jobTargets[job] = Math.floor(n * ratio / totalRatio);
        assigned += jobTargets[job];
      }
      const remainder = n - assigned;
      const byFraction = Object.entries(jobRatio)
        .map(([job, ratio]) => ({ job, frac: (n * ratio / totalRatio) % 1 }))
        .sort((a, b) => b.frac - a.frac);
      for (let i = 0; i < remainder; i++) jobTargets[byFraction[i].job]++;

      for (const [job, target] of Object.entries(jobTargets)) {
        try {
          corp.setJobAssignment(div, city, job, target);
        } catch (e) {
          ns.tprint(`WARN [corp/assign]: ${div}/${city} ${job}=${target}: ${e}`);
        }
      }
    }
  }
}

// ─── Corp-Upgrades ────────────────────────────────────────────────────────────

function buyCorpUpgrades(ns, corpInfo, phase) {
  // Don't buy upgrades when there are no divisions — nothing benefits from them,
  // and buying upgrades would drain the startup capital needed to create divisions.
  if (corpInfo.divisions.length === 0) return;
  // Don't buy upgrades when funds are negative
  if (corpInfo.funds < 0) return;
  // Budget: spend no more than 10% of funds per round on upgrades
  const budget = corpInfo.funds * 0.10;
  let spent = 0;

  for (const upgrade of CORP_UPGRADES) {
    if (spent >= budget) break;
    try {
      const cost = ns.corporation.getUpgradeLevelCost(upgrade);
      if (cost <= budget - spent && ns.corporation.getCorporation().funds >= cost) {
        ns.corporation.levelUpgrade(upgrade);
        spent += cost;
      }
    } catch { /* */ }
  }
}

// ─── Forschungen ─────────────────────────────────────────────────────────────

function buyResearch(ns, phase) {
  const corp = ns.corporation;
  const corpInfo = corp.getCorporation();
  const targets = phase === "late" ? [...EARLY_RESEARCH, ...LATE_RESEARCH] : EARLY_RESEARCH;

  for (const div of corpInfo.divisions) {
    for (const research of targets) {
      try {
        if (!corp.hasResearched(div, research)) {
          const cost = corp.getResearchCost(div, research);
          const divInfo = corp.getDivision(div);
          if (divInfo.researchPoints >= cost) {
            corp.research(div, research);
            ns.print(`${div}: Research unlocked: ${research}`);
          }
        }
      } catch { /* not available */ }
    }
  }
}

// ─── Morale / Energy ──────────────────────────────────────────────────────────

function maintainEmployeeStats(ns) {
  const corp = ns.corporation;
  const corpInfo = corp.getCorporation();

  // Always maintain morale/energy — low morale/energy collapses production far more
  // than the tea/party cost. Only skip parties (not tea) when deeply in debt.
  const deepInDebt = corpInfo.funds < -5e9;

  for (const div of corpInfo.divisions) {
    for (const city of CITIES) {
      try {
        const office = corp.getOffice(div, city);
        if (office.avgEnergy < 98) {
            corp.buyTea(div, city);
          }
          if (!deepInDebt && office.avgMorale < 98) {
            // Party: ~500k per employee
            corp.throwParty(div, city, 500_000);
          }
      } catch { /* */ }
    }
  }
}

// ─── Investition ──────────────────────────────────────────────────────────────

function handleInvestment(ns, corpInfo, phase, configFile) {
  if (corpInfo.public) return;
  if (phase === "late") return;

  const corp = ns.corporation;
  const config = loadCorpConfig(ns, configFile);

  try {
    const offer = corp.getInvestmentOffer();

    if (phase === "early" && offer.round === 1) {
      if (offer.funds >= INVEST_ROUND1_FUNDS_TARGET && config.corp.autoInvest) {
        corp.acceptInvestmentOffer();
        ns.print(`Investment round 1 accepted: ${ns.format.number(offer.funds)}$`);
      }
    }

    if (phase === "round2" && offer.round === 2) {
      if (offer.funds >= INVEST_ROUND2_FUNDS_TARGET && config.corp.autoInvest) {
        corp.acceptInvestmentOffer();
        ns.print(`Investment round 2 accepted: ${ns.format.number(offer.funds)}$`);
      }
    }

    // Börsengang wenn Runde 2 abgeschlossen
    if (phase === "round2" && offer.round > 2 && corpInfo.funds >= 1e12 && config.corp.autoGoPublic) {
      corp.goPublic(0);
      corp.issueDividends(0.1);
      ns.print("Corporation is now public!");
    }
  } catch { /* */ }
}

// ─── Produkte verwalten ───────────────────────────────────────────────────────

function manageProducts(ns, corpInfo, phase) {
  if (phase === "early") return;

  const corp = ns.corporation;
  const divNames = corpInfo.divisions;

  // Nur für Divisionen die Produkte machen (Tobacco)
  for (const divName of divNames) {
    try {
      const divInfo = corp.getDivision(divName);
      if (!divInfo.makesProducts) continue;

      const products = divInfo.products;
      const maxProducts = divInfo.maxProducts;

      // Fertige Produkte: Preis auf MP*TAx2 setzen
      for (const productName of products) {
        try {
          const product = corp.getProduct(divName, CITIES[0], productName);
          if (product.developmentProgress >= 100) {
            // Always set a base sell order first (Market-TA needs "MAX" qty as base)
            // Use "MP" as safe default price so products always sell;
            // Market-TA.II will override to find the optimal price once researched.
            for (const city of CITIES) {
              try {
                corp.sellProduct(divName, city, productName, "MAX", "MP", true);
              } catch { /* */ }
            }
            if (corp.hasResearched(divName, "Market-TA.II")) {
              corp.setProductMarketTA2(divName, productName, true);
              corp.setProductMarketTA1(divName, productName, true);
            }
          }
        } catch { /* */ }
      }

      // Neues Produkt starten wenn Platz
      const inDev = products.filter(p => {
        try {
          return corp.getProduct(divName, CITIES[0], p).developmentProgress < 100;
        } catch { return false; }
      });

      if (inDev.length === 0 && products.length < maxProducts) {
        const info = corp.getCorporation();
        // Don't invest in new products when funds are negative
        if (info.funds < 0) continue;
        const budget = Math.min(
          Math.max(info.funds * PRODUCT_DESIGN_BUDGET_RATIO, PRODUCT_MIN_INVEST),
          PRODUCT_MAX_INVEST,
        );
        const productName = `${divName.split(" ")[0]}-v${Date.now() % 10000}`;
        try {
          corp.makeProduct(divName, CITIES[0], productName, budget, budget);
          ns.print(`New product started: ${productName} | Investment: ${ns.format.number(budget)}$`);
        } catch { /* */ }
      }

      // Ältestes Produkt entfernen wenn Slots voll und kein Produkt in Entwicklung
      if (products.length >= maxProducts && inDev.length === 0) {
        // Niedrigstes Rating löschen
        let worstProduct = null;
        let worstRating = Infinity;
        for (const p of products) {
          try {
            const prod = corp.getProduct(divName, CITIES[0], p);
            if (prod.developmentProgress >= 100 && prod.rating < worstRating) {
              worstRating = prod.rating;
              worstProduct = p;
            }
          } catch { /* */ }
        }
        if (worstProduct) {
          corp.discontinueProduct(divName, worstProduct);
          ns.print(`Product discontinued (worst rating): ${worstProduct}`);
        }
      }
    } catch { /* */ }
  }
}

// ─── Sell-Orders setzen ───────────────────────────────────────────────────────

function setSellOrders(ns, phase) {
  const corp = ns.corporation;
  const corpInfo = corp.getCorporation();

  for (const divName of corpInfo.divisions) {
    try {
      const divInfo = corp.getDivision(divName);
      const industryData = corp.getIndustryData(divInfo.industry);

      // Verkaufte Materialien
      for (const material of (industryData.producedMaterials ?? [])) {
        for (const city of CITIES) {
          try {
            // Immer Basis-Verkaufsauftrag setzen (Market-TA braucht "MAX" als Basis)
            corp.sellMaterial(divName, city, material, "MAX", "MP");
            if (corp.hasResearched(divName, "Market-TA.II")) {
              corp.setMaterialMarketTA1(divName, city, material, true);
              corp.setMaterialMarketTA2(divName, city, material, true);
            }
          } catch { /* */ }
        }
      }
    } catch { /* */ }
  }
}

// ─── AdVerts ──────────────────────────────────────────────────────────────────

function buyAdVerts(ns, phase) {
  if (phase === "early") return;
  const corp = ns.corporation;
  const corpInfo = corp.getCorporation();

  for (const divName of corpInfo.divisions) {
    try {
      const cost = corp.getHireAdVertCost(divName);
      const info = corp.getCorporation();
      // Max 5% der Mittel für AdVerts
      if (info.funds >= cost && cost <= info.funds * 0.05) {
        corp.hireAdVert(divName);
        ns.print(`${divName}: AdVert purchased (Cost: ${ns.format.number(cost)}$)`);
      }
    } catch { /* */ }
  }
}

// ─── Boost-Materialien ────────────────────────────────────────────────────────

function buyBoostMaterials(ns, phase) {
  const corp = ns.corporation;
  const corpInfo = corp.getCorporation();

  // Don't buy boost materials when funds are negative
  if (corpInfo.funds < 0) return;

  for (const divName of corpInfo.divisions) {
    try {
      const divInfo = corp.getDivision(divName);
      const boostMap = divName === AGRI_DIV ? AGRI_BOOST : divName === TOBACCO_DIV ? TOBACCO_BOOST : null;
      if (!boostMap) continue;

      for (const city of divInfo.cities) {
        for (const [material, target] of Object.entries(boostMap)) {
          try {
            const mat = corp.getMaterial(divName, city, material);
            if (mat.stored < target) {
              const needed = target - mat.stored;
              // Bulk purchase wenn möglich
              const matData = corp.getMaterialData(material);
              const cost = matData.basePrice * needed;
              const info = corp.getCorporation();
              if (info.funds >= cost && cost <= info.funds * 0.15) {
                corp.bulkPurchase(divName, city, material, needed);
              }
            } else if (mat.stored > target * 1.1) {
              // Überschuss nicht mehr kaufen
              corp.buyMaterial(divName, city, material, 0);
            }
          } catch { /* */ }
        }
      }
    } catch { /* */ }
  }
}

// ─── Status für GUI ───────────────────────────────────────────────────────────

export function getCorpStatus(ns) {
  if (!ns.corporation || !ns.corporation.hasCorporation()) {
    return null;
  }

  try {
    const corp = ns.corporation.getCorporation();
    const offer = (() => {
      try { return ns.corporation.getInvestmentOffer(); } catch { return null; }
    })();
    const phase = determinePhase(ns, corp);

    return {
      name: corp.name,
      funds: corp.funds,
      revenue: corp.revenue,
      expenses: corp.expenses,
      profit: corp.revenue - corp.expenses,
      valuation: corp.valuation,
      public: corp.public,
      phase,
      investOffer: offer ? offer.funds : 0,
      investRound: offer ? offer.round : 0,
      divisions: corp.divisions.length,
    };
  } catch {
    return null;
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

function loadCorpConfig(ns, configFile) {
  const fallback = {
    corp: {
      autoInvest: false,
      autoGoPublic: false,
    },
  };

  try {
    const raw = ns.read(configFile);
    if (!raw || !raw.trim()) return fallback;
    const parsed = JSON.parse(raw);
    return {
      corp: {
        autoInvest: parsed?.services?.corporation?.autoInvest ?? false,
        autoGoPublic: parsed?.services?.corporation?.autoGoPublic ?? false,
      },
    };
  } catch {
    return fallback;
  }
}
