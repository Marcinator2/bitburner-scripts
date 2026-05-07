/** @param {NS} ns */

// All server→stock pairs ranked by manipulation efficiency: mv_max / shareTxForMovement_min
// (higher score = easier to move the forecast with fewer threads)
const MANIP_TARGETS = [
  { server: "netlink",          symbol: "NTLK",  score: 22.2 },
  { server: "joesguns",         symbol: "JGN",   score: 18.3 },
  { server: "sigma-cosmetics",  symbol: "SGC",   score: 13.8 },
  { server: "syscore",          symbol: "SYSC",  score: 11.3 },
  { server: "catalyst",         symbol: "CTYS",  score: 7.3  },
  { server: "alpha-ent",        symbol: "APHE",  score: 6.8  },
  { server: "clarkinc",         symbol: "CLRK",  score: 2.4  },
  { server: "blade",            symbol: "BLD",   score: 2.0  },
  { server: "vitalife",         symbol: "VITA",  score: 2.2  },
  { server: "lexo-corp",        symbol: "LXO",   score: 3.75 },
  { server: "omega-net",        symbol: "OMGA",  score: 3.7  },
  { server: "icarus",           symbol: "ICRS",  score: 1.94 },
  { server: "solaris",          symbol: "SLRS",  score: 1.9  },
  { server: "nova-med",         symbol: "NVMD",  score: 1.9  },
  { server: "omnia",            symbol: "OMN",   score: 1.79 },
  { server: "computek",         symbol: "CTK",   score: 1.67 },
  { server: "univ-energy",      symbol: "UNV",   score: 1.67 },
  { server: "ecorp",            symbol: "ECP",   score: 1.67 },
  { server: "megacorp",         symbol: "MGCP",  score: 1.67 },
  { server: "aerocorp",         symbol: "AERO",  score: 1.55 },
  { server: "global-pharm",     symbol: "GPH",   score: 1.55 },
  { server: "omnitek",          symbol: "OMTK",  score: 1.5  },
  { server: "4sigma",           symbol: "FSIG",  score: 1.5  },
  { server: "kuai-gong",        symbol: "KGI",   score: 1.5  },
  { server: "fulcrumtech",      symbol: "FLCM",  score: 1.5  },
  { server: "stormtech",        symbol: "STM",   score: 1.5  },
  { server: "defcomm",          symbol: "DCOMM", score: 1.5  },
  { server: "helios",           symbol: "HLS",   score: 1.5  },
  { server: "foodnstuff",       symbol: "FNS",   score: 1.33 },
  { server: "rho-construction",  symbol: "RHOC",  score: 1.17 },
  { server: "microdyne",        symbol: "MDYN",  score: 0.89 },
  { server: "titan-labs",       symbol: "TITN",  score: 0.78 },
];

export async function main(ns) {
  ns.disableLog("sleep");

  if (!ns.stock || (
    typeof ns.stock.buyStock !== "function" &&
    typeof ns.stock.purchaseTixApi !== "function" &&
    typeof ns.stock.hasTixApiAccess !== "function"
  )) {
    ns.tprint("Stock API not available. Requires WSE/TIX API.");
    return;
  }

  const getStockMethod = (...names) => {
    for (const name of names) {
      if (typeof ns.stock?.[name] === "function") {
        return ns.stock[name].bind(ns.stock);
      }
    }
    return null;
  };

  const stockApi = {
    getConstants: getStockMethod("getConstants"),
    hasTixApiAccess: getStockMethod("hasTixApiAccess"),
    purchaseTixApi: getStockMethod("purchaseTixApi"),
    has4SDataTixApi: getStockMethod("has4SDataTixApi", "has4SDataTIXAPI"),
    purchase4SMarketDataTixApi: getStockMethod("purchase4SMarketDataTixApi", "purchase4SMarketDataTIXAPI"),
  };
  const stockConstants = (() => {
    try {
      return stockApi.getConstants ? stockApi.getConstants() : {};
    } catch {
      return {};
    }
  })();

  const host = "home";

  const v_hack = "v_hack.js";
  const v_grow = "v_grow.js";
  const v_weaken = "v_weaken.js";
  const weakenRam = ns.getScriptRam(v_weaken);

  if (weakenRam <= 0) {
    ns.tprint(`Script ${v_weaken} is missing or has invalid RAM cost.`);
    return;
  }

  const pct_MinMoney = 0.2;
  const pct_MaxMoney = 0.8;
  const ramBuffer = 32;
  const txFee = 100_000;
  const buyForecast = 0.56;
  const sellForecast = 0.52;
  const minVolatility = 0.02;
  const maxOpenPositions = 10;
  const maxAllocationPerSymbol = 0.2;
  const rebuyCooldownMs = 90_000;
  const accessCheckIntervalMs = 30_000;
  const hardStopLossPct = 0.04;
  const forecastDropExit = 0.05;
  const rotationScoreRatio = 1.25;
  const rotationScoreMargin = 0.0015;
  const stockTickMs = Number(stockConstants.msPerStockUpdate) || 6_000;
  const minHoldMs = stockTickMs * 2;
  const trailingStopPct = 0.10;  // Trailing Stop: sell if price drops X% below peak
  const DEFAULT_LOOP_MS = 2000;
  let loopMs = DEFAULT_LOOP_MS;
  let useOwnedServers = false;
  let maxManipTargets = 2;
  let minCashReserveFraction = 0.05;
  try {
    const cfgRaw = ns.read("main_manager_config.js");
    if (cfgRaw) {
      const cfg = JSON.parse(cfgRaw);
      loopMs = Number(cfg?.services?.stocks?.loopMs) || DEFAULT_LOOP_MS;
      useOwnedServers = !!(cfg?.services?.stocks?.useOwnedServers);
      maxManipTargets = Number(cfg?.services?.stocks?.maxManipTargets) || 2;
      minCashReserveFraction = Number(cfg?.services?.stocks?.minCashReserveFraction) || 0.05;
    }
  } catch { /* use fallback */ }
  const rebuyBlockedUntil = {};
  const positionPeak = {};       // Highest bid price since purchase per symbol
  const positionEntryForecast = {};
  const positionEntryTime = {};
  let noTradeCycles = 0;
  let lastAccessSummary = "";
  let lastAccessCheckTs = 0;
  let singularityStatusLogged = false;

  function calcThreads() {
    const freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host) - ramBuffer;
    return Math.max(0, Math.floor(freeRam / weakenRam));
  }

  function execWorker(script, threads) {
    if (threads <= 0) return false;
    const pid = ns.exec(script, host, threads, company);
    return pid > 0;
  }

  function scanRootedHosts() {
    const visited = new Set([host]);
    const queue = [host];
    const rooted = [];
    const owned = new Set(ns.cloud.getServerNames());
    while (queue.length > 0) {
      const current = queue.shift();
      for (const neighbor of ns.scan(current)) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
        if (neighbor !== host && !owned.has(neighbor) && ns.hasRootAccess(neighbor)) {
          rooted.push(neighbor);
        }
      }
    }
    return rooted;
  }

  function calcAllManipHosts() {
    const hosts = [host];
    if (useOwnedServers) {
      hosts.push(...ns.cloud.getServerNames());
      hosts.push(...scanRootedHosts());
    }
    return hosts;
  }

  function calcThreadsOnHost(h) {
    const buffer = h === host ? ramBuffer : 0;
    const freeRam = ns.getServerMaxRam(h) - ns.getServerUsedRam(h) - buffer;
    return Math.max(0, Math.floor(freeRam / weakenRam));
  }

  const WORKER_SCRIPTS = [v_hack, v_grow, v_weaken];

  function ensureScriptsOnHost(h) {
    if (h === host) return;
    for (const s of WORKER_SCRIPTS) {
      if (!ns.fileExists(s, h)) {
        ns.scp(s, h, host);
      }
    }
  }

  function execWorkerOnHosts(script, server, hosts) {
    let total = 0;
    for (const h of hosts) {
      ensureScriptsOnHost(h);
      if (!ns.fileExists(script, h)) continue;
      const t = calcThreadsOnHost(h);
      if (t <= 0) continue;
      const pid = ns.exec(script, h, t, server);
      if (pid > 0) total += t;
    }
    return total;
  }

  function totalAvailableThreads() {
    return calcAllManipHosts().reduce((sum, h) => sum + calcThreadsOnHost(h), 0);
  }

  function selectManipTargets() {
    const hackLevel = ns.getHackingLevel();
    return MANIP_TARGETS
      .filter(t =>
        ns.serverExists(t.server) &&
        ns.hasRootAccess(t.server) &&
        ns.getServerRequiredHackingLevel(t.server) <= hackLevel &&
        ns.getServerMaxMoney(t.server) > 0
      )
      .slice(0, maxManipTargets);
  }

  function has4S() {
    return Boolean(stockApi.has4SDataTixApi && stockApi.has4SDataTixApi());
  }

  function getSignalScore(forecast, volatility) {
    return Math.max(0, forecast - 0.5) * volatility;
  }

  function getStockAccessSummary() {
    const hasTix = stockApi.hasTixApiAccess
      ? stockApi.hasTixApiAccess()
      : typeof ns.stock.buyStock === "function";
    const has4SDataTixApi = has4S();
    const missing = [];

    if (!hasTix) missing.push("TIX API");
    if (!has4SDataTixApi) missing.push("4S Market Data TIX API");

    return {
      hasTix,
      has4SDataTixApi,
      missing,
      ready: missing.length === 0,
    };
  }

  function canAfford(cost) {
    return !Number.isFinite(cost) || ns.getPlayer().money >= cost;
  }

  function ensureStockPrerequisites() {
    const purchases = [];
    const initialSummary = getStockAccessSummary();

    if (!initialSummary.hasTix && stockApi.purchaseTixApi && canAfford(Number(stockConstants.TixApiCost))) {
      if (stockApi.purchaseTixApi()) {
        purchases.push(`TIX API (${ns.format.number(Number(stockConstants.TixApiCost))}$)`);
      }
    }

    const afterTixSummary = getStockAccessSummary();
    if (
      afterTixSummary.hasTix &&
      !afterTixSummary.has4SDataTixApi &&
      stockApi.purchase4SMarketDataTixApi &&
      canAfford(Number(stockConstants.MarketDataTixApi4SCost))
    ) {
      if (stockApi.purchase4SMarketDataTixApi()) {
        purchases.push(`4S Market Data TIX API (${ns.format.number(Number(stockConstants.MarketDataTixApi4SCost))}$)`);
      }
    }

    const summary = getStockAccessSummary();
    const statusText = summary.ready
      ? "Stock prerequisites met"
      : `Stock prerequisites pending: ${summary.missing.join(", ")}`;

    if (purchases.length > 0) {
      ns.tprint(`Stock prerequisites purchased: ${purchases.join(", ")}`);
    }

    if (statusText !== lastAccessSummary) {
      ns.tprint(statusText);
      lastAccessSummary = statusText;
    }

    return summary;
  }

  function getMarketRegime(symbols) {
    let sumVol = 0;
    let sumEdge = 0;

    for (const sym of symbols) {
      const f = ns.stock.getForecast(sym);
      const v = ns.stock.getVolatility(sym);
      sumVol += v;
      sumEdge += Math.abs(f - 0.5);
    }

    const n = Math.max(1, symbols.length);
    const avgVol = sumVol / n;
    const avgEdge = sumEdge / n;

    if (avgVol >= 0.05 && avgEdge >= 0.055) {
      return {
        name: "HOT",
        buyF: buyForecast,
        sellF: sellForecast,
        minVol: minVolatility,
        maxPos: maxOpenPositions,
        allocPerSymbol: maxAllocationPerSymbol,
      };
    }

    if (avgVol <= 0.03 || avgEdge <= 0.035) {
      return {
        name: "QUIET",

        buyF: buyForecast + 0.01,
        sellF: sellForecast + 0.01,
        minVol: minVolatility + 0.002,
        maxPos: Math.max(7, maxOpenPositions - 2),
        allocPerSymbol: Math.max(0.16, maxAllocationPerSymbol - 0.03),
      };
    }

    return {
      name: "NORMAL",
      buyF: buyForecast,
      sellF: sellForecast,
      minVol: minVolatility,
      maxPos: Math.max(3, maxOpenPositions - 2),
      allocPerSymbol: Math.max(0.15, maxAllocationPerSymbol - 0.03),
    };
  }

  function run4SStrategy() {
    const symbols = ns.stock.getSymbols();
    const now = Date.now();
    const regime = getMarketRegime(symbols);
    const idleFactor = Math.min(1, noTradeCycles / 120);
    const adaptiveBuyF = Math.max(0.53, regime.buyF - idleFactor * 0.02);
    const adaptiveMinVol = Math.max(0.015, regime.minVol - idleFactor * 0.006);
    const playerMoney = ns.getPlayer().money;
    const minCashReserve = playerMoney * minCashReserveFraction;
    const tradableCash = Math.max(0, playerMoney - minCashReserve);
    const maxPerSymbolCash = tradableCash * regime.allocPerSymbol;
    let sells = 0;
    let blockedCooldown = 0;
    let blockedForecast = 0;
    let blockedVolatility = 0;
    let blockedBudget = 0;
    let buys = 0;
    let rotations = 0;
    let stoppedLoss = 0;
    let droppedForecast = 0;
    const heldPositions = [];

    // Execute exit rules first to free up capital.
    for (const sym of symbols) {
      const [shares, , avgBuyPrice] = ns.stock.getPosition(sym);
      if (shares <= 0) {
        delete positionPeak[sym]; // Position closed, reset peak
        delete positionEntryForecast[sym];
        delete positionEntryTime[sym];
        continue;
      }

      const bid = ns.stock.getBidPrice(sym);
      const forecast = ns.stock.getForecast(sym);
      const volatility = ns.stock.getVolatility(sym);

      if (positionEntryForecast[sym] === undefined) {
        positionEntryForecast[sym] = forecast;
      }
      if (positionEntryTime[sym] === undefined) {
        positionEntryTime[sym] = now;
      }

      // Peak aktualisieren
      if (!positionPeak[sym] || bid > positionPeak[sym]) {
        positionPeak[sym] = bid;
      }

      const heldMs = now - positionEntryTime[sym];
      const trailingStopPrice = positionPeak[sym] * (1 - trailingStopPct);
      const stopLossPrice = avgBuyPrice * (1 - hardStopLossPct);
      const trailingHit = bid <= trailingStopPrice;
      const forecastHit = forecast <= regime.sellF;
      const stopLossHit = bid <= stopLossPrice;
      const forecastDropHit = heldMs >= minHoldMs && (positionEntryForecast[sym] - forecast) >= forecastDropExit;

      if (stopLossHit || forecastDropHit || forecastHit || trailingHit) {
        const grund = stopLossHit
          ? `StopLoss (${ns.format.number(bid)} ≤ ${ns.format.number(stopLossPrice)})`
          : forecastDropHit
            ? `ForecastDrop (${positionEntryForecast[sym].toFixed(3)} → ${forecast.toFixed(3)})`
            : trailingHit
              ? `TrailingStop (peak=${ns.format.number(positionPeak[sym])} → now=${ns.format.number(bid)}, -${(((positionPeak[sym] - bid) / positionPeak[sym]) * 100).toFixed(1)}%)`
              : `Forecast (${forecast.toFixed(3)} ≤ ${regime.sellF})`;
        const sellPrice = ns.stock.sellStock(sym, shares);
        if (sellPrice > 0) {
          delete positionPeak[sym];
          delete positionEntryForecast[sym];
          delete positionEntryTime[sym];
          rebuyBlockedUntil[sym] = now + rebuyCooldownMs;
          sells++;
          if (stopLossHit) stoppedLoss++;
          if (forecastDropHit) droppedForecast++;
          const pnlPct = ((sellPrice - avgBuyPrice) / avgBuyPrice * 100).toFixed(1);
          ns.print(`4S SELL ${sym}: ${shares} @ ${ns.format.number(sellPrice)} (${pnlPct}%) | ${grund}`);
        }
        continue;
      }

      heldPositions.push({
        sym,
        shares,
        forecast,
        volatility,
        score: getSignalScore(forecast, volatility),
        avgBuyPrice,
        heldMs,
      });
    }

    // Kandidaten aufbauen und nach erwarteter Kante sortieren.
    const candidates = [];
    for (const sym of symbols) {
      const [shares] = ns.stock.getPosition(sym);
      if (shares > 0) continue;
      if ((rebuyBlockedUntil[sym] || 0) > now) {
        blockedCooldown++;
        continue;
      }

      const forecast = ns.stock.getForecast(sym);
      const vol = ns.stock.getVolatility(sym);
      if (forecast < adaptiveBuyF) {
        blockedForecast++;
        continue;
      }
      if (vol < adaptiveMinVol) {
        blockedVolatility++;
        continue;
      }

      const score = getSignalScore(forecast, vol);
      candidates.push({ sym, score, forecast, vol });
    }
    candidates.sort((a, b) => b.score - a.score);

    const currentOpenPositions = heldPositions.length;
    let slots = Math.max(0, regime.maxPos - currentOpenPositions);

    if (slots <= 0 && candidates.length > 0 && heldPositions.length > 0) {
      heldPositions.sort((a, b) => a.score - b.score);
      const weakestHeld = heldPositions[0];
      const bestCandidate = candidates[0];
      const rotationAllowed = weakestHeld.heldMs >= minHoldMs;
      const rotationBetter = bestCandidate.score > weakestHeld.score * rotationScoreRatio;
      const rotationFarEnough = (bestCandidate.score - weakestHeld.score) >= rotationScoreMargin;

      if (rotationAllowed && rotationBetter && rotationFarEnough) {
        const sellPrice = ns.stock.sellStock(weakestHeld.sym, weakestHeld.shares);
        if (sellPrice > 0) {
          delete positionPeak[weakestHeld.sym];
          delete positionEntryForecast[weakestHeld.sym];
          delete positionEntryTime[weakestHeld.sym];
          rebuyBlockedUntil[weakestHeld.sym] = now + rebuyCooldownMs;
          sells++;
          rotations++;
          slots = 1;
          ns.print(
            `4S ROTATE ${weakestHeld.sym} -> ${bestCandidate.sym}: ` +
            `score ${weakestHeld.score.toFixed(4)} -> ${bestCandidate.score.toFixed(4)}`
          );
        }
      }
    }

    if (slots <= 0) {
      if (buys === 0 && sells === 0) {
        noTradeCycles++;
      } else {
        noTradeCycles = 0;
      }

      return {
        regime: regime.name,
        buys,
        sells,
        rotations,
        stoppedLoss,
        droppedForecast,
        blockedCooldown,
        blockedForecast,
        blockedVolatility,
        blockedBudget,
        adaptiveBuyF,
        adaptiveMinVol,
        openPositions: Math.max(0, currentOpenPositions - rotations),
        tradableCash,
      };
    }

    let opened = 0;
    for (const c of candidates) {
      if (opened >= slots) break;

      const [shares] = ns.stock.getPosition(c.sym);
      const maxShares = ns.stock.getMaxShares(c.sym);
      const ask = ns.stock.getAskPrice(c.sym);
      const moneyNow = ns.getPlayer().money;
      const cashNow = Math.max(0, moneyNow - moneyNow * minCashReserveFraction - txFee);
      const budget = Math.min(maxPerSymbolCash, cashNow);
      const byBudget = Math.floor(budget / Math.max(1, ask));
      const qty = Math.min(maxShares - shares, byBudget);

      if (qty <= 0) {
        blockedBudget++;
        continue;
      }

      const buyPrice = ns.stock.buyStock(c.sym, qty);
      if (buyPrice > 0) {
        opened++;
        buys++;
        positionEntryForecast[c.sym] = c.forecast;
        positionEntryTime[c.sym] = now;
        positionPeak[c.sym] = ns.stock.getBidPrice(c.sym);
        ns.print(`4S BUY ${c.sym}: ${qty} @ ${ns.format.number(buyPrice)} f=${c.forecast.toFixed(3)} v=${c.vol.toFixed(3)}`);
      }
    }

    if (buys === 0 && sells === 0) {
      noTradeCycles++;
    } else {
      noTradeCycles = 0;
    }

    return {
      regime: regime.name,
      buys,
      sells,
      rotations,
      stoppedLoss,
      droppedForecast,
      blockedCooldown,
      blockedForecast,
      blockedVolatility,
      blockedBudget,
      adaptiveBuyF,
      adaptiveMinVol,
      openPositions: symbols.filter(s => ns.stock.getPosition(s)[0] > 0).length,
      tradableCash,
    };
  }

  let modeLogged = "";
  let lastRegime = "";
  let lastStatusTs = 0;

  // MANIP mode state: per-target phase tracking
  let manipTargets = [];        // [{ server, symbol, score, phase, nextLaunchAt }]
  let manipTargetRefreshAt = 0;
  const MANIP_REFRESH_MS = 60_000;

  if (!singularityStatusLogged) {
    ns.tprint(
      `Singularity API ${ns.singularity ? "available" : "not available"}. ` +
      "Stock access will be checked via ns.stock."
    );
    singularityStatusLogged = true;
  }

  ensureStockPrerequisites();
  lastAccessCheckTs = Date.now();
  
  while (true) {
    const accessNowTs = Date.now();
    if (accessNowTs - lastAccessCheckTs >= accessCheckIntervalMs) {
      ensureStockPrerequisites();
      lastAccessCheckTs = accessNowTs;
    }

    const accessSummary = getStockAccessSummary();
    if (!accessSummary.hasTix) {
      await ns.sleep(2000);
      continue;
    }

    if (has4S()) {
      if (modeLogged !== "4S") {
        ns.tprint("Stock Manager mode: 4S Forecast Trading (multi-symbol)");
        modeLogged = "4S";
      }
      const status = run4SStrategy();
      if (status?.regime && status.regime !== lastRegime) {
        ns.tprint(`4S Regime change: ${status.regime}`);
        lastRegime = status.regime;
      }
      const now = Date.now();
      if (status && now - lastStatusTs > 30_000) {
       /* ns.tprint(
          `4S Status | regime=${status.regime} open=${status.openPositions} cash=${ns.format.number(status.tradableCash)} ` +
          `buyF=${status.adaptiveBuyF.toFixed(3)} minVol=${status.adaptiveMinVol.toFixed(3)} ` +
          `buys=${status.buys} sells=${status.sells} rot=${status.rotations} stop=${status.stoppedLoss} drop=${status.droppedForecast} ` +
          `block(forecast=${status.blockedForecast},vol=${status.blockedVolatility},cd=${status.blockedCooldown},budget=${status.blockedBudget})`
        );
        */
        lastStatusTs = now;
      }
      await ns.sleep(loopMs);
      continue;
    }

    // --- MANIP mode: auto-select best rooted targets and run non-blocking scheduler ---
    const now = Date.now();
    if (now >= manipTargetRefreshAt) {
      const fresh = selectManipTargets();
      // Keep existing state for already-active targets; init new ones
      manipTargets = fresh.map(f => {
        const existing = manipTargets.find(e => e.server === f.server);
        return existing ?? { server: f.server, symbol: f.symbol, phase: "hack", nextLaunchAt: 0 };
      });
      manipTargetRefreshAt = now + MANIP_REFRESH_MS;
    }

    if (manipTargets.length === 0) {
      if (modeLogged !== "MANIP_WAIT") {
        ns.tprint("MANIP: No rooted targets available yet. Waiting...");
        modeLogged = "MANIP_WAIT";
      }
      await ns.sleep(5000);
      continue;
    }

    if (modeLogged !== "MANIP") {
      ns.tprint(`Stock Manager mode: Auto-Manipulation (${manipTargets.length} target(s): ${manipTargets.map(t => t.symbol).join(", ")})`);
      modeLogged = "MANIP";
    }

    const allHosts = calcAllManipHosts();

    for (let i = 0; i < manipTargets.length; i++) {
      const t = manipTargets[i];
      // Partition hosts: each target gets hosts at positions i, i+N, i+2N, ...
      const hosts = allHosts.filter((_, idx) => idx % manipTargets.length === i);
      if (hosts.length === 0) continue;

      const curMoney = ns.getServerMoneyAvailable(t.server);
      const maxMoney = ns.getServerMaxMoney(t.server);
      const curSec = ns.getServerSecurityLevel(t.server);
      const minSec = ns.getServerMinSecurityLevel(t.server);
      const [shares] = ns.stock.getPosition(t.symbol);

      // State transitions: sell when money is high enough, buy when low enough
      if (curMoney >= maxMoney * pct_MaxMoney && shares > 0) {
        const sellPrice = ns.stock.sellStock(t.symbol, shares);
        if (sellPrice > 0) {
          rebuyBlockedUntil[t.symbol] = now + rebuyCooldownMs;
          ns.tprint(`MANIP SELL ${t.symbol}: ${shares} @ ${ns.format.number(sellPrice)}`);
          t.phase = "hack";
          t.nextLaunchAt = 0;
        }
      } else if (t.phase === "hack" && curMoney <= maxMoney * pct_MinMoney && shares <= 0 && (rebuyBlockedUntil[t.symbol] || 0) <= now) {
        const maxAvailable = ns.stock.getMaxShares(t.symbol);
        const askPrice = ns.stock.getAskPrice(t.symbol);
        const cash = ns.getPlayer().money;
        const budget = Math.max(0, cash - cash * minCashReserveFraction - txFee);
        const qty = Math.min(maxAvailable, Math.floor(budget / Math.max(1, askPrice)));
        if (qty > 0) {
          const buyPrice = ns.stock.buyStock(t.symbol, qty);
          if (buyPrice > 0) {
            ns.tprint(`MANIP BUY ${t.symbol}: ${qty} @ ${ns.format.number(buyPrice)}`);
            t.phase = "grow";
            t.nextLaunchAt = 0;
          }
        }
      }

      // Don't re-launch workers until previous batch should be done
      if (now < t.nextLaunchAt) continue;

      let script, opTime;
      if (curSec > minSec + 2) {
        script = v_weaken;
        opTime = ns.getWeakenTime(t.server);
      } else if (t.phase === "grow" || shares > 0) {
        script = v_grow;
        opTime = ns.getGrowTime(t.server);
      } else {
        script = v_hack;
        opTime = ns.getHackTime(t.server);
      }

      const launched = execWorkerOnHosts(script, t.server, hosts);
      if (launched > 0) {
        t.nextLaunchAt = now + opTime + 200;
        ns.print(`MANIP ${t.symbol} [${t.phase}]: ${launched} threads on ${hosts.length} host(s)`);
      }
    }

    await ns.sleep(loopMs);
  }
}