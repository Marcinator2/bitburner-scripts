/** @param {NS} ns */

const DEFAULT_FILE = "player_stats_data.txt";
const REFRESH_MS = 1000;
const CHART_POINTS = 24;
const TREND_WINDOWS = [
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
  { label: "30m", seconds: 1800 },
  { label: "Gesamt", seconds: Infinity },
];

export async function main(ns) {
  const file = ns.args[0] || DEFAULT_FILE;
  const runOnce = String(ns.args[1] || "").toLowerCase() === "once";

  ns.disableLog("sleep");
  ns.disableLog("read");
  ns.tail();

  while (true) {
    ns.clearLog();
    renderDashboard(ns, file);

    if (runOnce) {
      return;
    }

    await ns.sleep(REFRESH_MS);
  }
}

function renderDashboard(ns, file) {
  const history = loadHistory(ns, file);
  if (!history || history.samples.length < 2) {
    ns.print("PLAYER STATS");
    ns.print("");
    ns.print(`Keine ausreichenden Daten in ${file}.`);
    ns.print("Starte zuerst den Worker:");
    ns.print("run player_stats_worker.js");
    return;
  }

  const samples = history.samples;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const durationSec = Math.max(1, (last.timestamp - first.timestamp) / 1000);

  const moneyPerSec = (last.money - first.money) / durationSec;
  const hackingExpPerSec = (last.exp.hacking - first.exp.hacking) / durationSec;
  const avgCombatLevel = getAverageCombatLevel(last);
  const avgCombatDelta = avgCombatLevel - getAverageCombatLevel(first);

  ns.print("PLAYER STATS");
  ns.print("");
  ns.print(`Datei: ${file}`);
  ns.print(`Fenster: ${formatDuration(durationSec)} | Samples: ${samples.length}`);
  ns.print(`Intervall: ${formatDuration((history.sampleMs || 0) / 1000)}`);
  ns.print("");

  ns.print(`Geld:        ${ns.formatNumber(last.money)}`);
  ns.print(`Geld / sec:  ${formatSigned(ns, moneyPerSec)}`);
  ns.print(`Hack Lvl:    ${last.skills.hacking} (${formatDelta(last.skills.hacking - first.skills.hacking)})`);
  ns.print(`Hack XP/sec: ${formatSigned(ns, hackingExpPerSec)}`);
  ns.print(`Combat Avg:  ${avgCombatLevel.toFixed(1)} (${formatDelta(avgCombatDelta, 1)})`);
  ns.print(`HP:          ${last.hp.current}/${last.hp.max}`);
  ns.print(`Karma:       ${last.karma.toFixed(2)}`);
  ns.print(`Kills:       ${last.numPeopleKilled}`);
  ns.print(`Stadt:       ${last.city}`);
  ns.print("");

  printTrendTable(ns, samples);
  ns.print("");

  ns.print("Kampfstats im Fenster:");
  printStatDelta(ns, "STR", first.skills.strength, last.skills.strength);
  printStatDelta(ns, "DEF", first.skills.defense, last.skills.defense);
  printStatDelta(ns, "DEX", first.skills.dexterity, last.skills.dexterity);
  printStatDelta(ns, "AGI", first.skills.agility, last.skills.agility);
  printStatDelta(ns, "CHA", first.skills.charisma, last.skills.charisma);
  ns.print("");

  printChartSection(ns, "Geldverlauf", samples, sample => sample.money, value => ns.formatNumber(value));
  printChartSection(ns, "Hack-XP Verlauf", samples, sample => sample.exp.hacking, value => ns.formatNumber(value));
  printChartSection(ns, "Combat Avg Verlauf", samples, getAverageCombatLevel, value => value.toFixed(1));
  printChartSection(ns, "STR Verlauf", samples, sample => sample.skills.strength, value => value.toFixed(0));
  printChartSection(ns, "DEX Verlauf", samples, sample => sample.skills.dexterity, value => value.toFixed(0));
}

function loadHistory(ns, file) {
  const raw = ns.read(file);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.samples)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function printStatDelta(ns, label, startValue, endValue) {
  const diff = endValue - startValue;
  ns.print(`${label}: ${endValue} (${formatDelta(diff)})`);
}

function printTrendTable(ns, samples) {
  ns.print("Trends:");

  for (const window of TREND_WINDOWS) {
    const windowSamples = getSamplesForWindow(samples, window.seconds);
    if (windowSamples.length < 2) {
      ns.print(`${padRight(window.label, 6)} nicht genug Daten`);
      continue;
    }

    const first = windowSamples[0];
    const last = windowSamples[windowSamples.length - 1];
    const durationSec = Math.max(1, (last.timestamp - first.timestamp) / 1000);
    const moneyPerSec = (last.money - first.money) / durationSec;
    const hackingXpPerSec = (last.exp.hacking - first.exp.hacking) / durationSec;
    const hackLevelDelta = last.skills.hacking - first.skills.hacking;

    ns.print(
      `${padRight(window.label, 6)} ` +
      `$/s ${padLeft(formatSigned(ns, moneyPerSec), 10)} | ` +
      `XP/s ${padLeft(formatSigned(ns, hackingXpPerSec), 10)} | ` +
      `Hack ${padLeft(formatDelta(hackLevelDelta), 6)}`
    );
  }
}

function printChartSection(ns, title, samples, selector, formatter) {
  const stats = summarizeSeries(samples, selector);
  ns.print(`${title}:`);
  ns.print(buildAsciiChart(samples, CHART_POINTS, selector));
  ns.print(
    `Min ${formatter(stats.min)} | Max ${formatter(stats.max)} | Delta ${formatSeriesDelta(stats.delta, formatter)}`
  );
  ns.print("");
}

function summarizeSeries(samples, selector) {
  const values = samples.map(selector);

  return {
    min: Math.min(...values),
    max: Math.max(...values),
    delta: values[values.length - 1] - values[0],
  };
}

function buildAsciiChart(samples, maxPoints, selector) {
  const recent = samples.slice(-maxPoints);
  const values = recent.map(selector);
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (max === min) {
    return "[========================]";
  }

  return recent
    .map(sample => {
      const value = selector(sample);
      const normalized = (value - min) / (max - min);
      const height = Math.max(1, Math.round(normalized * 8));
      return "#".repeat(height).padEnd(8, ".");
    })
    .join("|");
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
}

function formatSigned(ns, value) {
  const prefix = value >= 0 ? "+" : "-";
  return `${prefix}${ns.formatNumber(Math.abs(value))}`;
}

function formatDelta(value, decimals = 0) {
  const numericValue = Number(value);
  const formattedValue = decimals > 0 ? numericValue.toFixed(decimals) : Math.round(numericValue).toString();
  return numericValue >= 0 ? `+${formattedValue}` : formattedValue;
}

function formatSeriesDelta(value, formatter) {
  const numericValue = Number(value);
  const prefix = numericValue >= 0 ? "+" : "-";
  return `${prefix}${formatter(Math.abs(numericValue))}`;
}

function getAverageCombatLevel(sample) {
  const { strength, defense, dexterity, agility } = sample.skills;
  return (strength + defense + dexterity + agility) / 4;
}

function getSamplesForWindow(samples, seconds) {
  if (!Number.isFinite(seconds)) {
    return samples;
  }

  const endTimestamp = samples[samples.length - 1].timestamp;
  const startTimestamp = endTimestamp - (seconds * 1000);
  const windowSamples = samples.filter(sample => sample.timestamp >= startTimestamp);

  return windowSamples.length > 0 ? windowSamples : [samples[samples.length - 1]];
}

function padLeft(value, width) {
  return String(value).padStart(width, " ");
}

function padRight(value, width) {
  return String(value).padEnd(width, " ");
}