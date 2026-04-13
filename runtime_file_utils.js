/** @param {NS} ns */

export function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function ensureJsonFile(ns, file, fallback) {
  const raw = ns.read(file);
  if (!raw) {
    const createdValue = cloneJson(fallback);
    ns.write(file, JSON.stringify(createdValue, null, 2), "w");
    return {
      value: createdValue,
      created: true,
      repaired: false,
    };
  }

  try {
    return {
      value: JSON.parse(raw),
      created: false,
      repaired: false,
    };
  } catch {
    const repairedValue = cloneJson(fallback);
    ns.write(file, JSON.stringify(repairedValue, null, 2), "w");
    return {
      value: repairedValue,
      created: false,
      repaired: true,
    };
  }
}