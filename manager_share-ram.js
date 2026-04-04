/** @param {NS} ns */
//needs Source-File 4 to run
export async function main(ns) {
    const hostname = ns.getHostname();
    const worker = "share-ram.js";
    let ram_available = ns.getServerMaxRam("home") - ns.getServerUsedRam("home")
    const ram_needed = ns.getScriptRam(worker, hostname);
    let threads = Math.floor(ram_available / ram_needed);

    if (threads > 0) {

        ns.exec(worker, hostname, threads);
        
    }
}
