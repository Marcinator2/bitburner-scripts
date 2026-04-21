/** @param {NS} ns */
// manager_ipvgo.js
// Plays IPvGO matches in a loop.
// Strategy: 1-ply simulation – for every valid move, simulate the board,
// count own/opponent territory via flood-fill, pick move that maximises
// (own_territory - opponent_territory) + captures * 5.

export async function main(ns) {
  ns.disableLog("ALL");

  const OPPONENT   = String(ns.args[0] || "Slum Snakes");
  const BOARD_SIZE = Number(ns.args[1]) || 7;

  let wins = 0, losses = 0, draws = 0, totalGames = 0;
  ns.print(`[IPvGO] Starting loop vs "${OPPONENT}" on ${BOARD_SIZE}x${BOARD_SIZE} board.`);

  while (true) {
    try {
      await ns.go.resetBoardState(OPPONENT, BOARD_SIZE);
    } catch (e) {
      ns.print(`[IPvGO] resetBoardState failed: ${e}. Retrying in 5s...`);
      await ns.sleep(5000);
      continue;
    }

    totalGames++;
    let consecutivePasses = 0;
    ns.print(`[IPvGO] Game ${totalGames} started.`);

    while (true) {
      let board, validMoves, liberties;
      try {
        board      = ns.go.getBoardState();
        validMoves = ns.go.analysis.getValidMoves();
        liberties  = ns.go.analysis.getLiberties();
      } catch (e) {
        ns.print(`[IPvGO] Read error: ${e}`);
        break;
      }

      const size = board.length;
      const move = pickMove(board, validMoves, liberties, size);

      let result;
      try {
        if (move) {
          result = await ns.go.makeMove(move.x, move.y);
          consecutivePasses = 0;
        } else {
          result = await ns.go.passTurn();
          consecutivePasses++;
        }
      } catch (e) {
        ns.print(`[IPvGO] Move error: ${e}`);
        break;
      }

      if (!result || result.type === "gameOver") break;
      if (consecutivePasses >= 2) { try { await ns.go.passTurn(); } catch (_) {} break; }
      if (result.type === "move") await ns.sleep(200);
    }

    try {
      const state = ns.go.getGameState();
      if (state?.blackScore !== undefined) {
        if (state.blackScore > state.whiteScore)      wins++;
        else if (state.blackScore < state.whiteScore) losses++;
        else                                           draws++;
      }
    } catch (_) {}

    ns.clearLog();
    ns.print(`[IPvGO] Opponent: ${OPPONENT} | Board: ${BOARD_SIZE}x${BOARD_SIZE}`);
    ns.print(`[IPvGO] Games: ${totalGames} | W: ${wins} | L: ${losses} | D: ${draws}`);
    ns.print(`[IPvGO] Win rate: ${totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : "0.0"}%`);
    await ns.sleep(500);
  }
}

// ── Move selection ───────────────────────────────────────────────────────────

function pickMove(board, validMoves, liberties, size) {
  const cur = toArr(board);
  const { xT: baseX, oT: baseO } = countTerritory(cur, size);
  const baseline = baseX - baseO;

  let bestScore = -Infinity;
  let bestMove  = null;

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (!validMoves[x]?.[y]) continue;

      const sim  = simulate(cur, x, y, size);
      const caps = countCaptured(cur, sim, size);
      const { xT, oT } = countTerritory(sim, size);

      // Main score: territory gain + capture bonus
      let score = (xT - oT - baseline) * 2 + caps * 5;

      // Bonus: saves own chain in atari
      for (const [ax, ay] of neighbors(x, y, size)) {
        if (cur[ax]?.[ay] === 'X' && (liberties[ax]?.[ay] ?? 4) === 1) score += 15;
      }

      // Mild center preference in opening
      score += Math.min(x, y, size - 1 - x, size - 1 - y) * 0.3;

      if (score > bestScore) { bestScore = score; bestMove = { x, y }; }
    }
  }

  // Pass only when no move is even marginally beneficial
  return bestScore > -2 ? bestMove : null;
}

// ── Board simulation ─────────────────────────────────────────────────────────

function toArr(board) {
  return board.map(col => col.split(''));
}

function simulate(boardArr, mx, my, size) {
  const b = boardArr.map(col => [...col]);
  b[mx][my] = 'X';
  // Capture adjacent opponent chains with no liberties
  for (const [ax, ay] of neighbors(mx, my, size)) {
    if (b[ax]?.[ay] !== 'O') continue;
    const chain = traceChain(b, ax, ay, 'O', size);
    if (chainLiberties(b, chain, size) === 0) {
      for (const [cx, cy] of chain) b[cx][cy] = '.';
    }
  }
  return b;
}

function traceChain(b, sx, sy, color, size) {
  const chain = [], seen = new Set();
  const stack = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack.pop();
    const k = x * 25 + y;
    if (seen.has(k) || b[x]?.[y] !== color) continue;
    seen.add(k);
    chain.push([x, y]);
    for (const n of neighbors(x, y, size)) stack.push(n);
  }
  return chain;
}

function chainLiberties(b, chain, size) {
  const ls = new Set();
  for (const [x, y] of chain)
    for (const [nx, ny] of neighbors(x, y, size))
      if (b[nx]?.[ny] === '.') ls.add(nx * 25 + ny);
  return ls.size;
}

function countCaptured(before, after, size) {
  let n = 0;
  for (let x = 0; x < size; x++)
    for (let y = 0; y < size; y++)
      if (before[x]?.[y] === 'O' && after[x]?.[y] === '.') n++;
  return n;
}

// ── Territory counting (flood-fill over empty regions) ───────────────────────

function countTerritory(b, size) {
  const seen = new Set();
  let xT = 0, oT = 0;

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const k = x * 25 + y;
      if (b[x]?.[y] !== '.' || seen.has(k)) continue;

      const region = [];
      let touchX = false, touchO = false;
      const queue = [[x, y]];

      while (queue.length) {
        const [cx, cy] = queue.shift();
        const ck = cx * 25 + cy;
        if (seen.has(ck)) continue;
        const cell = b[cx]?.[cy];
        if (!cell || cell === '#') continue;
        if (cell === '.') {
          seen.add(ck);
          region.push([cx, cy]);
          for (const n of neighbors(cx, cy, size)) queue.push(n);
        } else if (cell === 'X') { touchX = true; }
          else if (cell === 'O') { touchO = true; }
      }

      if (touchX && !touchO) xT += region.length;
      else if (touchO && !touchX) oT += region.length;
    }
  }
  return { xT, oT };
}

// ── Utility ──────────────────────────────────────────────────────────────────

function neighbors(x, y, size) {
  const r = [];
  if (x > 0)        r.push([x-1, y]);
  if (x < size - 1) r.push([x+1, y]);
  if (y > 0)        r.push([x, y-1]);
  if (y < size - 1) r.push([x, y+1]);
  return r;
}

