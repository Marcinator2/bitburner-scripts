/** @param {NS} ns */
// bootstrap_study.js — Study best hack course at Rothman University (SF4 only).
// Launched by bootstrap.js when SF4 is available and enough RAM is free.
// Self-terminates once main_manager.js is running.

export async function main(ns) {
  ns.disableLog("ALL");

  const LOOP_MS      = 10_000;
  const MAIN_MANAGER = "main_manager.js";
  const HOME         = "home";

  // Hack courses at Rothman University (Sector-12), sorted best to cheapest.
  // Base costs from source (money/s) × Rothman costMult 3.
  const HACK_COURSES = [
    { name: "Algorithms",             classType: "Algorithms",         costPerSec: 960 },
    { name: "Networks",               classType: "Networks",           costPerSec: 240 },
    { name: "Data Structures",        classType: "Data Structures",    costPerSec: 120 },
    { name: "Study Computer Science", classType: "Computer Science",   costPerSec: 0   },
  ];
  const HACK_CLASS_TYPES = new Set(HACK_COURSES.map(c => c.classType));

  ns.print("[study] Started. Will self-terminate when main_manager.js runs.");

  while (true) {
    if (ns.scriptRunning(MAIN_MANAGER, HOME)) {
      ns.print("[study] main_manager.js detected. Terminating.");
      return;
    }

    // Sum up hacknet production ($/s) to pick the best affordable course
    let hacknetIncome = 0;
    const numNodes = ns.hacknet.numNodes();
    for (let i = 0; i < numNodes; i++) {
      try { hacknetIncome += ns.hacknet.getNodeStats(i).production; } catch (_) {}
    }

    const bestCourse = HACK_COURSES.find(c => hacknetIncome >= c.costPerSec)
      ?? HACK_COURSES[HACK_COURSES.length - 1];

    let currentWork = null;
    try { currentWork = ns.singularity.getCurrentWork(); } catch (_) {}

    const currentClassType = currentWork?.classType ?? "";
    const isStudyingHack   = currentWork?.type === "CLASS" && HACK_CLASS_TYPES.has(currentClassType);
    const isOnBestCourse   = isStudyingHack && currentClassType === bestCourse.classType;
    const isIdle           = currentWork === null;

    const hackLevel = ns.getHackingLevel();

    if (isIdle || (isStudyingHack && !isOnBestCourse)) {
      try {
        ns.singularity.universityCourse("Rothman University", bestCourse.name, false);
        ns.print(`[study] Started: ${bestCourse.name} (hacknet: ${ns.format.number(hacknetIncome)}/s, hack ${hackLevel}).`);
      } catch (_) {}
    } else if (isOnBestCourse) {
      ns.print(`[study] Studying ${bestCourse.name} (hack ${hackLevel}, hacknet: ${ns.format.number(hacknetIncome)}/s).`);
    } else {
      ns.print(`[study] Working: ${currentWork?.type} – not interrupting.`);
    }

    await ns.sleep(LOOP_MS);
  }
}
