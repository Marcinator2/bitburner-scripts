/** @param {NS} ns */
//needs Source-File 4 to run
export async function main(ns) {
    if (!ns.singularity || typeof ns.singularity.gymWorkout !== "function") {
        ns.tprint("Error: Singularity API not available. Requires Source-File 4.");
        return;
    }

    const stats = ["strength", "defense", "dexterity", "agility"];

    while (true) {
        let p = ns.getPlayer().skills;
        
        // Wir suchen das Objekt mit dem niedrigsten Wert
        let lowestStat = stats.reduce((min, current) => 
            p[current] < p[min] ? current : min
        );

        let currentVal = p[lowestStat];

        ns.tprint(`Niedrigster Stat: ${lowestStat.toUpperCase()} (${currentVal})`);

        // Automatisch trainieren, wenn du die Singularity API hast:
        ns.singularity.gymWorkout("Powerhouse Gym", lowestStat);
        

        await ns.sleep(10000);
    }
}