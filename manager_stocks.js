/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("sleep");

  if (!ns.stock || (
    typeof ns.stock.buyStock !== "function" &&
    typeof ns.stock.purchaseTixApi !== "function" &&
    typeof ns.stock.hasTixApiAccess !== "function"
  )) {
    ns.tprint("Stock API nicht verfügbar. Benötigt WSE/TIX API.");//test
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

  const firma = ns.args[0] || "joesguns";
  const symbol_Firma = ns.args[1] || "JGN";
  const host = "home";

  const v_hack = "v_hack.js";
  const v_grow = "v_grow.js";
  const v_weaken = "v_weaken.js";
  const weakenRam = ns.getScriptRam(v_weaken);

  if (!ns.serverExists(firma)) {
    ns.tprint(`Server ${firma} existiert nicht.`);
    return;
  }
  if (weakenRam <= 0) {
    ns.tprint(`Script ${v_weaken} fehlt oder hat ungültige RAM-Kosten.`);
    return;
  }

  const pct_MinMoney = 0.2;
  const pct_MaxMoney = 0.8;
  const ramPuffer = 32;
  const maxKaufMenge = 10_000_000_000;
  const minCashReserve = 10_000_000;
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
  const trailingStopPct = 0.10;  // Trailing Stop: Verkauf wenn Preis X% unter Höchststand fällt
  const rebuyBlockedUntil = {};
  const positionPeak = {};       // Höchster Bid-Preis seit Kauf je Symbol
  const positionEntryForecast = {};
  const positionEntryTime = {};
  let noTradeCycles = 0;
  let lastAccessSummary = "";
  let lastAccessCheckTs = 0;
  let singularityStatusLogged = false;

  function calcThreads() {
    const freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host) - ramPuffer;
    return Math.max(0, Math.floor(freeRam / weakenRam));
  }

  function execWorker(script, threads) {
    if (threads <= 0) return false;
    const pid = ns.exec(script, host, threads, firma);
    return pid > 0;
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
        purchases.push(`TIX API (${ns.formatNumber(Number(stockConstants.TixApiCost))}$)`);
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
        purchases.push(`4S Market Data TIX API (${ns.formatNumber(Number(stockConstants.MarketDataTixApi4SCost))}$)`);
      }
    }

    const summary = getStockAccessSummary();
    const statusText = summary.ready
      ? "Aktien-Voraussetzungen erfüllt"
      : `Aktien-Voraussetzungen offen: ${summary.missing.join(", ")}`;

    if (purchases.length > 0) {
      ns.tprint(`Aktien-Voraussetzungen gekauft: ${purchases.join(", ")}`);
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

        /*//für test Daten von hot genommen
        buyF: buyForecast,
        sellF: sellForecast + 0.01,
        minVol: minVolatility,
        maxPos: Math.max(2, maxOpenPositions - 4),
        allocPerSymbol: Math.max(0.12, maxAllocationPerSymbol - 0.08),
        */
        buyF: buyForecast,
        sellF: sellForecast,
        minVol: minVolatility,
        maxPos: maxOpenPositions,
        allocPerSymbol: maxAllocationPerSymbol,



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

    // Erst Exit-Regeln ausführen, damit Kapital frei wird.
    for (const sym of symbols) {
      const [shares, , avgBuyPrice] = ns.stock.getPosition(sym);
      if (shares <= 0) {
        delete positionPeak[sym]; // Position ist weg, Peak zurücksetzen
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
          ? `StopLoss (${ns.formatNumber(bid)} ≤ ${ns.formatNumber(stopLossPrice)})`
          : forecastDropHit
            ? `ForecastDrop (${positionEntryForecast[sym].toFixed(3)} → ${forecast.toFixed(3)})`
            : trailingHit
              ? `TrailingStop (peak=${ns.formatNumber(positionPeak[sym])} → now=${ns.formatNumber(bid)}, -${(((positionPeak[sym] - bid) / positionPeak[sym]) * 100).toFixed(1)}%)`
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
          ns.print(`4S SELL ${sym}: ${shares} @ ${ns.formatNumber(sellPrice)} (${pnlPct}%) | ${grund}`);
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
      const cashNow = Math.max(0, ns.getPlayer().money - minCashReserve - txFee);
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
        ns.print(`4S BUY ${c.sym}: ${qty} @ ${ns.formatNumber(buyPrice)} f=${c.forecast.toFixed(3)} v=${c.vol.toFixed(3)}`);
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

  if (!singularityStatusLogged) {
    ns.tprint(
      `Singularity API ${ns.singularity ? "verfügbar" : "nicht verfügbar"}. ` +
      "Börsen-Freischaltungen werden über ns.stock geprüft."
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
        ns.tprint("Stock-Manager Modus: 4S Forecast Trading (Multi-Symbol)");
        modeLogged = "4S";
      }
      const status = run4SStrategy();
      if (status?.regime && status.regime !== lastRegime) {
        ns.tprint(`4S Regime-Wechsel: ${status.regime}`);
        lastRegime = status.regime;
      }
      const now = Date.now();
      if (status && now - lastStatusTs > 30_000) {
        ns.tprint(
          `4S Status | regime=${status.regime} open=${status.openPositions} cash=${ns.formatNumber(status.tradableCash)} ` +
          `buyF=${status.adaptiveBuyF.toFixed(3)} minVol=${status.adaptiveMinVol.toFixed(3)} ` +
          `buys=${status.buys} sells=${status.sells} rot=${status.rotations} stop=${status.stoppedLoss} drop=${status.droppedForecast} ` +
          `block(forecast=${status.blockedForecast},vol=${status.blockedVolatility},cd=${status.blockedCooldown},budget=${status.blockedBudget})`
        );
        lastStatusTs = now;
      }
      await ns.sleep(2000);
      continue;
    }

    if (modeLogged !== "MANIP") {
      ns.tprint(`Stock-Manager Modus: Manipulation/Fallback (${symbol_Firma} auf ${firma})`);
      modeLogged = "MANIP";
    }

    const curMoney = ns.getServerMoneyAvailable(firma);
    const maxMoney = ns.getServerMaxMoney(firma);
    const curSec = ns.getServerSecurityLevel(firma);
    const minSec = ns.getServerMinSecurityLevel(firma);
    const [longShares] = ns.stock.getPosition(symbol_Firma);

    // Threads IM Loop berechnen, damit wir immer aktuell sind
    let threads = calcThreads();

    if (threads <= 0) { await ns.sleep(1000); continue; }

    // PRIORITÄT 1: SECURITY
    if (curSec > minSec + 2) {
      ns.print("Security zu hoch...");
      execWorker(v_weaken, threads);
      await ns.sleep(ns.getWeakenTime(firma) + 100);
    } 
    
    // PRIORITÄT 2: LONG MANÖVER
    else if (curMoney < maxMoney * pct_MinMoney && longShares <= 0) {
      if ((rebuyBlockedUntil[symbol_Firma] || 0) > Date.now()) {
        await ns.sleep(500);
        continue;
      }

      const maxAvailable = ns.stock.getMaxShares(symbol_Firma);
      const askPrice = ns.stock.getAskPrice(symbol_Firma);
      const cash = ns.getPlayer().money;
      const budget = Math.max(0, cash - minCashReserve - txFee);
      const durchBudget = Math.floor(budget / Math.max(1, askPrice));
      const kaufMenge = Math.min(maxKaufMenge, Math.max(0, maxAvailable - longShares), durchBudget);
      
      if (kaufMenge <= 0) {
        await ns.sleep(1000);
        continue;
      }

      const kaufPreis = ns.stock.buyStock(symbol_Firma, kaufMenge);
      
      if (kaufPreis > 0) {
        ns.tprint(`--- LONG START: ${kaufMenge} Aktien ---`);
        while (ns.getServerMoneyAvailable(firma) < maxMoney * pct_MaxMoney) {
          // Innerhalb der Schleife Threads neu berechnen!
          let loopThreads = calcThreads();
          if (loopThreads <= 0) { await ns.sleep(1000); continue; }

          if (ns.getServerSecurityLevel(firma) > minSec + 2) {
            execWorker(v_weaken, loopThreads);
            await ns.sleep(ns.getWeakenTime(firma) + 100);
          } else {
            execWorker(v_grow, loopThreads);
            await ns.sleep(ns.getGrowTime(firma) + 100);
          }
        }
        const [heldShares] = ns.stock.getPosition(symbol_Firma);
        if (heldShares > 0) {
          ns.stock.sellStock(symbol_Firma, heldShares);
          rebuyBlockedUntil[symbol_Firma] = Date.now() + rebuyCooldownMs;
          ns.tprint(`--- LONG VERKAUFT (${heldShares}) ---`);
        }
      } else {
        ns.print("Kauf fehlgeschlagen (Geld oder Limit).");
      }
    }

// PRIORITÄT 3: VORBEREITUNG FÜR NÄCHSTEN KAUF (Hacken ohne Short)
    else if (curMoney > maxMoney * pct_MaxMoney) {
      ns.print("Preis ist hoch. Hacke Server leer für den nächsten Zyklus...");
      
      while (ns.getServerMoneyAvailable(firma) > maxMoney * pct_MinMoney) {
        let loopThreads = calcThreads();
        if (loopThreads <= 0) { await ns.sleep(1000); continue; }

        if (ns.getServerSecurityLevel(firma) > minSec + 2) {
          execWorker(v_weaken, loopThreads);
          await ns.sleep(ns.getWeakenTime(firma) + 100);
        } else {
          execWorker(v_hack, loopThreads);
          await ns.sleep(ns.getHackTime(firma) + 100);
        }
      }
      ns.tprint("--- BODEN ERREICHT: BEREIT FÜR NÄCHSTEN LONG-KAUF ---");
    }
    
    else {
      execWorker(v_grow, threads);
      await ns.sleep(ns.getGrowTime(firma) + 100);
    }
    await ns.sleep(200);
  }
}