// STATUS: Test/duplicate script of find-server.js.
// Use find-server.js for production use; keep changes there only.
/** @param {NS} ns */
export async function main(ns) {
  // ns.args[0] is the first word after the script name
  const target = ns.args[0]; 

  // Safety check: was an argument actually passed?
  if (!target) {
    ns.tprint("❌ Error: Please specify a target server.");
    ns.tprint("Example: run find-server.js n00dles");
    return;
  }

  let path = findPath(ns, "home", target);

  if (path) {
    ns.tprint("🚀 Path to " + target + " found:");
    ns.tprint(path.join(" -> "));
    
    // Bonus: directly output the finished command for copy-pasting
    ns.tprint("Terminal: connect " + path.slice(1).join("; connect "));
  } else {
    ns.tprint("❌ Path to " + target + " not found. Typo?");
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