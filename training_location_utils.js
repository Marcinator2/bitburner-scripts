export const CITY_TRAVEL_COST = 200_000;
export const GYM_BASE_COST = 120;

export const UNIVERSITY_LOCATIONS = [
  { city: "Volhaven", name: "ZB Institute of Technology", expMult: 4, costMult: 5 },
  { city: "Aevum", name: "Summit University", expMult: 3, costMult: 4 },
  { city: "Sector-12", name: "Rothman University", expMult: 2, costMult: 3 },
];

export const GYM_LOCATIONS = [
  { city: "Sector-12", name: "Powerhouse Gym", expMult: 10, costMult: 20 },
  { city: "Aevum", name: "Snap Fitness Gym", expMult: 5, costMult: 10 },
  { city: "Volhaven", name: "Millenium Fitness Gym", expMult: 4, costMult: 7 },
  { city: "Aevum", name: "Crush Fitness Gym", expMult: 2, costMult: 3 },
  { city: "Sector-12", name: "Iron Gym", expMult: 1, costMult: 1 },
];

export const UNIVERSITY_COURSE_BASE_COSTS = {
  "study computer science": 0,
  "computer science": 0,
  "data structures": 40,
  networks: 80,
  algorithms: 320,
  management: 160,
  leadership: 320,
};

const UNIVERSITY_COURSE_TYPES = {
  "study computer science": "Computer Science",
  "computer science": "Computer Science",
  "data structures": "Data Structures",
  networks: "Networks",
  algorithms: "Algorithms",
  management: "Management",
  leadership: "Leadership",
};

const UNIVERSITY_EXP_FIELDS = {
  "Computer Science": "hackExp",
  "Data Structures": "hackExp",
  Networks: "hackExp",
  Algorithms: "hackExp",
  Management: "chaExp",
  Leadership: "chaExp",
};

const GYM_CLASS_TYPES = {
  strength: "str",
  defense: "def",
  dexterity: "dex",
  agility: "agi",
};

const GYM_EXP_FIELDS = {
  strength: "strExp",
  defense: "defExp",
  dexterity: "dexExp",
  agility: "agiExp",
};

export function selectBestUniversity(ns, player, courseName, configuredLocation) {
  return selectBestLocation({
    ns,
    player,
    options: UNIVERSITY_LOCATIONS,
    configuredLocation,
    getStartupCost: option => getUniversityStartupCost(option, courseName, player.city),
    getXpPerSecond: option => getUniversityXpPerSecond(ns, player, courseName, option),
    configuredLabel: "konfigurierte Uni als Fallback",
    bestLabel: "beste XP/s Uni",
    affordableLabel: "beste bezahlbare XP/s Uni",
    cheapestLabel: "guenstigste erreichbare Vorbereitung",
  });
}

export function selectBestGym(ns, player, stat, configuredLocation) {
  return selectBestLocation({
    ns,
    player,
    options: GYM_LOCATIONS,
    configuredLocation,
    getStartupCost: option => getGymStartupCost(option, player.city),
    getXpPerSecond: option => getGymXpPerSecond(ns, player, stat, option),
    configuredLabel: "konfiguriertes Gym als Fallback",
    bestLabel: "bestes XP/s Gym",
    affordableLabel: "bestes bezahlbares XP/s Gym",
    cheapestLabel: "guenstigste erreichbare Vorbereitung",
  });
}

export function getConfiguredLocation(options, city, name) {
  if (!city || !name) {
    return options[0] || { city: "", name: "", expMult: 0, costMult: 0 };
  }

  return options.find(option => option.city === city && option.name === name) || {
    city,
    name,
    expMult: 0,
    costMult: 0,
  };
}

export function getUniversityCourseBaseCost(courseName) {
  const normalized = normalizeCourseName(courseName);
  return UNIVERSITY_COURSE_BASE_COSTS[normalized] ?? UNIVERSITY_COURSE_BASE_COSTS.leadership;
}

export function normalizeUniversityCourse(courseName) {
  const normalized = normalizeCourseName(courseName);
  return UNIVERSITY_COURSE_TYPES[normalized] || UNIVERSITY_COURSE_TYPES.leadership;
}

function normalizeCourseName(courseName) {
  return String(courseName || "").trim().toLowerCase();
}

function selectBestLocation({
  ns,
  player,
  options,
  configuredLocation,
  getStartupCost,
  getXpPerSecond,
  configuredLabel,
  bestLabel,
  affordableLabel,
  cheapestLabel,
}) {
  const scored = options
    .map(option => ({
      ...option,
      startupCost: getStartupCost(option),
      xpPerSecond: getXpPerSecond(option),
    }))
    .sort((left, right) => {
      if (right.xpPerSecond !== left.xpPerSecond) return right.xpPerSecond - left.xpPerSecond;
      return left.startupCost - right.startupCost;
    });

  const best = scored[0] || configuredLocation;
  const affordable = scored.filter(option => player.money >= option.startupCost);

  if (affordable.length > 0) {
    const choice = affordable[0];
    return {
      ...choice,
      reason: choice.name === best.name
        ? `${bestLabel} (${formatRate(choice.xpPerSecond)} XP/s)`
        : `${affordableLabel} (${formatRate(choice.xpPerSecond)} XP/s, ${ns.formatNumber(choice.startupCost)}$ Startkosten)`,
    };
  }

  const cheapest = [...scored].sort((left, right) => {
    if (left.startupCost !== right.startupCost) return left.startupCost - right.startupCost;
    return right.xpPerSecond - left.xpPerSecond;
  })[0] || configuredLocation;

  if (configuredLocation?.name && cheapest.name === configuredLocation.name) {
    return {
      ...cheapest,
      reason: configuredLabel,
    };
  }

  return {
    ...cheapest,
    reason: `${cheapestLabel} (${ns.formatNumber(cheapest.startupCost || 0)}$)`,
  };
}

function getUniversityStartupCost(option, courseName, currentCity) {
  const travelCost = currentCity === option.city ? 0 : CITY_TRAVEL_COST;
  return travelCost + (getUniversityCourseBaseCost(courseName) * option.costMult);
}

function getGymStartupCost(option, currentCity) {
  const travelCost = currentCity === option.city ? 0 : CITY_TRAVEL_COST;
  return travelCost + (GYM_BASE_COST * option.costMult);
}

function getUniversityXpPerSecond(ns, player, courseName, option) {
  try {
    if (typeof ns.formulas?.work?.universityGains === "function") {
      const classType = normalizeUniversityCourse(courseName);
      const gains = ns.formulas.work.universityGains(player, classType, option.name);
      return Number(gains?.[UNIVERSITY_EXP_FIELDS[classType]] || 0);
    }
  } catch {
  }

  return option.expMult;
}

function getGymXpPerSecond(ns, player, stat, option) {
  try {
    if (typeof ns.formulas?.work?.gymGains === "function") {
      const classType = GYM_CLASS_TYPES[stat];
      const gains = ns.formulas.work.gymGains(player, classType, option.name);
      return Number(gains?.[GYM_EXP_FIELDS[stat]] || 0);
    }
  } catch {
  }

  return option.expMult;
}

function formatRate(value) {
  return Number.isFinite(value) ? value.toFixed(3) : "0.000";
}