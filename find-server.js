/** @param {NS} ns */
export async function main(ns) {
  // ns.args[0] ist das erste Wort nach dem Skriptnamen
  const target = ns.args[0]; 

  // Sicherheitscheck: Wurde überhaupt ein Argument übergeben?
  if (!target) {
    ns.tprint("❌ Fehler: Bitte gib einen Zielserver an.");
    ns.tprint("Beispiel: run find-server.js n00dles");
    return;
  }

  let path = findPath(ns, "home", target);

  if (path) {
    ns.tprint("🚀 Pfad zu " + target + " gefunden:");
    ns.tprint(path.join(" -> "));
    
    // Kleiner Bonus: Direkt den fertigen Befehl zum Kopieren ausgeben
    ns.tprint("Terminal: connect " + path.slice(1).join("; connect "));
  } else {
    ns.tprint("❌ Pfad zu " + target + " nicht gefunden. Tippfehler?");
  }
}

// Deine findPath Funktion bleibt gleich...
function findPath(ns, start, target) {
  let queue = [[start]];
  let visited = new Set();
  visited.add(start);

  while (queue.length > 0) {
    let path = queue.shift();
    let node = path[path.length - 1];

    if (node === target) return path;

    let neighbors = ns.scan(node);
    for (let neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return null;
}