/** @param {NS} ns */

import { ensureJsonFile } from "./runtime_file_utils.js";

const DEFAULT_FILE = "player_stats_data.txt";
const DEFAULT_SAMPLE_MS = 10000;
const DEFAULT_MAX_SAMPLES = 360;

export async function main(ns) {
  const file = ns.args[0] || DEFAULT_FILE;
  const sampleMs = Number(ns.args[1] || DEFAULT_SAMPLE_MS);
  const maxSamples = Number(ns.args[2] || DEFAULT_MAX_SAMPLES);

  ns.disableLog("sleep");
  ns.disableLog("write");
  ns.disableLog("read");

  if (!Number.isFinite(sampleMs) || sampleMs < 1000) {
    ns.tprint("Fehler: sampleMs muss mindestens 1000 sein.");
    return;
  }

  if (!Number.isFinite(maxSamples) || maxSamples < 2) {
    ns.tprint("Fehler: maxSamples muss mindestens 2 sein.");
    return;
  }

  ensureHistoryFile(ns, file, sampleMs, maxSamples);

  while (true) {
    const history = loadHistory(ns, file);
    history.sampleMs = sampleMs;
    history.maxSamples = maxSamples;
    history.samples.push(createSample(ns));

    if (history.samples.length > maxSamples) {
      history.samples.splice(0, history.samples.length - maxSamples);
    }

    ns.write(file, JSON.stringify(history, null, 2), "w");
    ns.print(`Samples: ${history.samples.length}/${maxSamples} -> ${file}`);

    await ns.sleep(sampleMs);
  }
}

function ensureHistoryFile(ns, file, sampleMs, maxSamples) {
  ensureJsonFile(ns, file, {
    version: 1,
    sampleMs,
    maxSamples,
    samples: [],
  });
}

function loadHistory(ns, file) {
  const raw = ns.read(file);
  if (!raw) {
    return {
      version: 1,
      sampleMs: DEFAULT_SAMPLE_MS,
      maxSamples: DEFAULT_MAX_SAMPLES,
      samples: [],
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.samples)) {
      throw new Error("ungueltiges Format");
    }

    return {
      version: 1,
      sampleMs: Number(parsed.sampleMs) || DEFAULT_SAMPLE_MS,
      maxSamples: Number(parsed.maxSamples) || DEFAULT_MAX_SAMPLES,
      samples: parsed.samples,
    };
  } catch {
    ns.print(`Warnung: ${file} konnte nicht gelesen werden. Historie wird neu aufgebaut.`);
    return {
      version: 1,
      sampleMs: DEFAULT_SAMPLE_MS,
      maxSamples: DEFAULT_MAX_SAMPLES,
      samples: [],
    };
  }
}

function createSample(ns) {
  const player = ns.getPlayer();

  return {
    timestamp: Date.now(),
    money: player.money,
    city: player.city,
    karma: player.karma,
    numPeopleKilled: player.numPeopleKilled,
    hp: {
      current: player.hp.current,
      max: player.hp.max,
    },
    skills: {
      hacking: player.skills.hacking,
      strength: player.skills.strength,
      defense: player.skills.defense,
      dexterity: player.skills.dexterity,
      agility: player.skills.agility,
      charisma: player.skills.charisma,
    },
    exp: {
      hacking: player.exp.hacking,
      strength: player.exp.strength,
      defense: player.exp.defense,
      dexterity: player.exp.dexterity,
      agility: player.exp.agility,
      charisma: player.exp.charisma,
    },
  };
}