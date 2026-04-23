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

  if (!ns.corporation.hasCorporation()) {
    ns.tprint("ERROR: Keine Corporation vorhanden. Bitte zuerst eine Corporation gründen.");
    return;
  }

  ns.print("Corporation Manager gestartet.");

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

  // 1. Unlocks sicherstellen
  ensureUnlocks(ns);

  // 2. Divisions anlegen falls fehlen
  ensureDivisions(ns);

  // 3. Warehouses + Offices sicherstellen
  const phase = determinePhase(ns, corpInfo);
  ensureInfrastructure(ns, phase);

  // 4. Smart Supply aktivieren
  enableSmartSupply(ns);

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

// ─── Unlocks ──────────────────────────────────────────────────────────────────

function ensureUnlocks(ns) {
  const corp = ns.corporation;
  for (const unlock of REQUIRED_UNLOCKS) {
    try {
      if (!corp.hasUnlock(unlock)) {
        const cost = corp.getUnlockCost(unlock);
        const info = corp.getCorporation();
        if (info.funds >= cost) {
          corp.purchaseUnlock(unlock);
          ns.print(`Unlock purchased: ${unlock}`);
        }
      }
    } catch {
      // Unlock nicht verfügbar (z.B. Office/Warehouse API fehlt)
    }
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
      const cost = 40e9; // Agriculture kostet 40b
      if (info.funds >= cost) {
        corp.expandIndustry("Agriculture", AGRI_DIV);
        ns.print(`Division created: ${AGRI_DIV}`);
      }
    } catch (e) {
      ns.print(`WARN: Could not create ${AGRI_DIV}: ${e}`);
    }
  }

  if (!divNames.includes(TOBACCO_DIV)) {
    try {
      const info = corp.getCorporation();
      // Tobacco kostet 20b
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

  const targetSize = OFFICE_SIZES[phase] ?? OFFICE_SIZES.early;

  // Job distribution by phase.
  // Late ratio {6,8,8,4,10} sums to 36 — chosen so that with only 3 employees
  // the Largest Remainder Method yields Engineer=1, Business=1, R&D=1 (not all Operations).
  const jobRatio = phase === "early"
    ? { "Operations": 1, "Engineer": 2, "Business": 1, "Management": 1, "Research & Development": 4 }
    : phase === "round1"
      ? { "Operations": 6, "Engineer": 6, "Business": 6, "Management": 6, "Research & Development": 6 }
      : { "Operations": 6, "Engineer": 8, "Business": 8, "Management": 4, "Research & Development": 10 };

  for (const div of corpInfo.divisions) {
    for (const city of CITIES) {
      try {
        const office = corp.getOffice(div, city);
        // Fill open positions (one per tick to save RAM)
        while (office.numEmployees < office.size) {
          const result = corp.hireEmployee(div, city);
          if (!result) break;
          break;
        }

        // Largest Remainder Method: most accurate proportional assignment at any office size
        const totalRatio = Object.values(jobRatio).reduce((a, b) => a + b, 0);
        const n = office.numEmployees;
        const jobTargets = {};
        let assigned = 0;
        for (const [job, ratio] of Object.entries(jobRatio)) {
          jobTargets[job] = Math.floor(n * ratio / totalRatio);
          assigned += jobTargets[job];
        }
        // Distribute remainder slots to the roles with the largest fractional parts
        const remainder = n - assigned;
        const byFraction = Object.entries(jobRatio)
          .map(([job, ratio]) => ({ job, frac: (n * ratio / totalRatio) % 1 }))
          .sort((a, b) => b.frac - a.frac);
        for (let i = 0; i < remainder; i++) {
          jobTargets[byFraction[i].job]++;
        }
        for (const [job, target] of Object.entries(jobTargets)) {
          try {
            corp.setAutoJobAssignment(div, city, job, target);
          } catch { /* */ }
        }
      } catch { /* */ }
    }
  }
}

// ─── Corp-Upgrades ────────────────────────────────────────────────────────────

function buyCorpUpgrades(ns, corpInfo, phase) {
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
      } catch { /* nicht verfügbar */ }
    }
  }
}

// ─── Morale / Energy ──────────────────────────────────────────────────────────

function maintainEmployeeStats(ns) {
  const corp = ns.corporation;
  const corpInfo = corp.getCorporation();

  // Don't spend on tea/party when funds are negative
  if (corpInfo.funds < 0) return;

  for (const div of corpInfo.divisions) {
    for (const city of CITIES) {
      try {
        const office = corp.getOffice(div, city);
        if (office.avgEnergy < 98) {
          corp.buyTea(div, city);
        }
        if (office.avgMorale < 98) {
          // Party: ~500k pro Mitarbeiter
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
        ns.print(`Investment round 1 accepted: ${ns.formatNumber(offer.funds)}$`);
      }
    }

    if (phase === "round2" && offer.round === 2) {
      if (offer.funds >= INVEST_ROUND2_FUNDS_TARGET && config.corp.autoInvest) {
        corp.acceptInvestmentOffer();
        ns.print(`Investment round 2 accepted: ${ns.formatNumber(offer.funds)}$`);
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
          ns.print(`New product started: ${productName} | Investment: ${ns.formatNumber(budget)}$`);
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
      const industryData = corp.getIndustryData(divInfo.type);

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
        ns.print(`${divName}: AdVert purchased (Cost: ${ns.formatNumber(cost)}$)`);
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
