/** @param {NS} ns */
// manager_ipvgo.js
// Plays IPvGO matches in a loop.

// ── Opponent-specific strategies ─────────────────────────────────────────────
// captureW:      bonus per captured stone
// connW:         bonus per adjacent own stone (connectivity)
// atariW:        bonus per opponent chain placed in atari
// preAtariW:     bonus per opponent chain reduced to 2 libs (pre-atari pressure)
// cutW:          bonus per opponent group separated by our move
// bridgeW:       bonus per own group connected by our move
// selfAtari1:    penalty when new chain has 1 liberty and no captures
// selfAtari2:    penalty when new chain has 2 liberties and no captures
// eyeFill:       penalty for filling own eye
// cornerW:       multiplier for early-game corner/edge preference
// passThresh:    pass if best move score is below this
// opponentSkillW: 0=ignore opponent response, 1=assume perfect opponent

const STRATEGIES = {
  "Netburners": {
    // Weak at IPvGO — hunt isolated stones, assume they won't find best reply
    captureW: 10, connW: 2.0, atariW: 14, preAtariW: 6, cutW: 8,  bridgeW: 2,
    selfAtari1: 22, selfAtari2: 4,  eyeFill: 15, cornerW: 1.5, passThresh: -2,
    opponentSkillW: 0.35,
  },
  "Slum Snakes": {
    // Long snake chains — cutting through them and threatening atari is key
    captureW: 8,  connW: 2.0, atariW: 16, preAtariW: 4, cutW: 14, bridgeW: 2,
    selfAtari1: 30, selfAtari2: 6,  eyeFill: 20, cornerW: 1.5, passThresh: -2,
    opponentSkillW: 0.75,
  },
  "The Black Hand": {
    // Very aggressive surrounder — connect everything, build 2-eye groups, never self-atari
    captureW: 5,  connW: 5.0, atariW: 8,  preAtariW: 3, cutW: 4,  bridgeW: 10,
    selfAtari1: 50, selfAtari2: 15, eyeFill: 35, cornerW: 2.0, passThresh: -2,
    opponentSkillW: 1.0,
  },
  "Tetrads": {
    // Cutters — bridge own groups to avoid being cut, also cut them back
    captureW: 5,  connW: 5.0, atariW: 8,  preAtariW: 3, cutW: 10, bridgeW: 12,
    selfAtari1: 35, selfAtari2: 8,  eyeFill: 20, cornerW: 1.5, passThresh: -2,
    opponentSkillW: 0.9,
  },
  "Illuminati": {
    // Heavily prepared defenses — careful, avoid traps, high atari awareness
    captureW: 5,  connW: 3.5, atariW: 10, preAtariW: 3, cutW: 6,  bridgeW: 5,
    selfAtari1: 45, selfAtari2: 12, eyeFill: 28, cornerW: 1.2, passThresh: -2,
    opponentSkillW: 1.0,
  },
};

const DEFAULT_STRATEGY = {
  captureW: 5,  connW: 2.5, atariW: 8,  preAtariW: 3, cutW: 4,  bridgeW: 2,
  selfAtari1: 30, selfAtari2: 6,  eyeFill: 20, cornerW: 1.5, passThresh: -2,
  opponentSkillW: 0.8,
};

export async function main(ns) {
  ns.disableLog("ALL");

  const OPPONENT   = String(ns.args[0] || "Slum Snakes");
  const BOARD_SIZE = Number(ns.args[1]) || 7;
  const strategy   = STRATEGIES[OPPONENT] ?? DEFAULT_STRATEGY;

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
      const move = pickMove(board, validMoves, liberties, size, strategy);

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

function pickMove(board, validMoves, liberties, size, strategy) {
  const cur = toArr(board);
  const { xT: baseX, oT: baseO } = countTerritory(cur, size);
  const baseline = baseX - baseO;

  let bestScore = -Infinity;
  let bestMove  = null;

  // Count stones on board to detect game phase
  let totalStones = 0;
  for (let x = 0; x < size; x++)
    for (let y = 0; y < size; y++)
      if (cur[x]?.[y] !== '.' && cur[x]?.[y] !== '#') totalStones++;

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (!validMoves[x]?.[y]) continue;

      // 1st ply: our move
      const sim1 = simulateMove(cur, x, y, 'X', size);
      const caps = countCaptured(cur, sim1, size, 'O');

      // 2nd ply: opponent's best response — score after they reply
      // opponentSkillW < 1 means we assume they won't always find the best reply
      const sim2 = opponentBestResponse(sim1, size);
      const { xT: xT1, oT: oT1 } = countTerritory(sim1, size);
      const { xT: xT2, oT: oT2 } = countTerritory(sim2, size);
      const sw = strategy.opponentSkillW;
      const xT = xT1 + (xT2 - xT1) * sw;
      const oT = oT1 + (oT2 - oT1) * sw;

      // Main score: territory advantage after opponent replies + capture bonus
      let score = (xT - oT - baseline) * 2 + caps * strategy.captureW;

      // Bonus: saves own chain in atari
      for (const [ax, ay] of neighbors(x, y, size)) {
        if (cur[ax]?.[ay] === 'X' && (liberties[ax]?.[ay] ?? 4) === 1) score += 15;
      }

      // Position preference: corners in early game, center later
      const edgeDist = Math.min(x, y, size - 1 - x, size - 1 - y);
      score += totalStones < size * 2
        ? (2 - edgeDist) * strategy.cornerW  // early: corners/edges preferred
        : edgeDist * 0.2;                     // late: mild center preference

      // Connection bonus: extending own chains is good
      for (const [nx, ny] of neighbors(x, y, size))
        if (cur[nx]?.[ny] === 'X') score += strategy.connW;

      // Bonus: puts opponent chain in atari after our move
      score += opponentChainsInAtariAfterMove(sim1, x, y, size) * strategy.atariW;

      // Bonus: reduces opponent chain to 2 libs (pre-atari pressure, will capture next move)
      score += opponentChainsToTwoLibsAfterMove(sim1, x, y, size) * strategy.preAtariW;

      // Cut bonus: move separates two or more opponent groups
      const oppGroups = countAdjacentGroups(cur, x, y, 'O', size);
      if (oppGroups >= 2) score += strategy.cutW * (oppGroups - 1);

      // Bridge bonus: move connects two or more own groups
      const ownGroups = countAdjacentGroups(cur, x, y, 'X', size);
      if (ownGroups >= 2) score += strategy.bridgeW * (ownGroups - 1);

      // Penalty: self-atari (own new chain ends up with 1 lib, no captures)
      const ownChain = traceChain(sim1, x, y, 'X', size);
      const ownLibs  = chainLiberties(sim1, ownChain, size);
      if (ownLibs === 1 && caps === 0) score -= strategy.selfAtari1;
      else if (ownLibs === 2 && caps === 0) score -= strategy.selfAtari2;

      // Penalty: filling own eye
      if (isEye(cur, x, y, 'X', size)) score -= strategy.eyeFill;

      if (score > bestScore) { bestScore = score; bestMove = { x, y }; }
    }
  }

  // Pass only when no move is even marginally beneficial
  return bestScore > strategy.passThresh ? bestMove : null;
}

// Find the opponent's best single reply on the given board (used for 2-ply)
function opponentBestResponse(board, size) {
  let bestScore = -Infinity;
  let bestBoard = board;

  // Include pass as an option (opponent might be content with current position)
  const { xT: pxT, oT: poT } = countTerritory(board, size);
  bestScore = (poT - pxT) * 2;

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (board[x]?.[y] !== '.') continue;

      const sim = simulateMove(board, x, y, 'O', size);

      // Skip suicide (chain has 0 liberties and no captures were made)
      const chain  = traceChain(sim, x, y, 'O', size);
      const libs   = chainLiberties(sim, chain, size);
      const xCaps  = countCaptured(board, sim, size, 'X');
      if (libs === 0 && xCaps === 0) continue;

      const { xT, oT } = countTerritory(sim, size);
      let score = (oT - xT) * 2 + xCaps * 5;

      // Opponent also avoids self-atari and filling their own eyes
      if (libs === 1 && xCaps === 0) score -= 15;
      if (isEye(board, x, y, 'O', size)) score -= 10;

      if (score > bestScore) { bestScore = score; bestBoard = sim; }
    }
  }

  return bestBoard;
}

// ── Board simulation ─────────────────────────────────────────────────────────

function toArr(board) {
  return board.map(col => col.split(''));
}

// Generalized simulate: place `color` at (mx,my) and capture dead opponent chains
function simulateMove(boardArr, mx, my, color, size) {
  const b   = boardArr.map(col => [...col]);
  const opp = color === 'X' ? 'O' : 'X';
  b[mx][my] = color;
  for (const [ax, ay] of neighbors(mx, my, size)) {
    if (b[ax]?.[ay] !== opp) continue;
    const chain = traceChain(b, ax, ay, opp, size);
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
    const k = x * size + y;
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

function countCaptured(before, after, size, capturedColor) {
  let n = 0;
  for (let x = 0; x < size; x++)
    for (let y = 0; y < size; y++)
      if (before[x]?.[y] === capturedColor && after[x]?.[y] === '.') n++;
  return n;
}

// ── Territory counting (flood-fill over empty regions) ───────────────────────

function countTerritory(b, size) {
  const seen = new Set();
  let xT = 0, oT = 0;

  // Count stones — controlled nodes include placed stones (area scoring)
  for (let x = 0; x < size; x++)
    for (let y = 0; y < size; y++) {
      if (b[x]?.[y] === 'X') xT++;
      else if (b[x]?.[y] === 'O') oT++;
    }

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const k = x * size + y;
      if (b[x]?.[y] !== '.' || seen.has(k)) continue;

      const region = [];
      let touchX = false, touchO = false;
      const queue = [[x, y]];

      while (queue.length) {
        const [cx, cy] = queue.shift();
        const ck = cx * size + cy;
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

// ── Group adjacency ──────────────────────────────────────────────────────────

// Returns the number of distinct groups of `color` adjacent to (x,y).
// Used for cut detection (color='O') and bridge detection (color='X').
function countAdjacentGroups(b, x, y, color, size) {
  const seen = new Set();
  let count = 0;
  for (const [nx, ny] of neighbors(x, y, size)) {
    if (b[nx]?.[ny] !== color) continue;
    const k = nx * size + ny;
    if (seen.has(k)) continue;
    const chain = traceChain(b, nx, ny, color, size);
    for (const [cx, cy] of chain) seen.add(cx * size + cy);
    count++;
  }
  return count;
}

// ── Eye detection ─────────────────────────────────────────────────────────────

function isEye(b, x, y, color, size) {
  if (b[x]?.[y] !== '.') return false;
  for (const [nx, ny] of neighbors(x, y, size)) {
    if (b[nx]?.[ny] !== color) return false;
  }
  return true;
}

function opponentChainsInAtariAfterMove(after, mx, my, size) {
  let count = 0;
  const seen = new Set();
  for (const [nx, ny] of neighbors(mx, my, size)) {
    if (after[nx]?.[ny] !== 'O') continue;
    const k = nx * size + ny;
    if (seen.has(k)) continue;
    const chain = traceChain(after, nx, ny, 'O', size);
    for (const [cx, cy] of chain) seen.add(cx * size + cy);
    if (chainLiberties(after, chain, size) === 1) count++;
  }
  return count;
}

function opponentChainsToTwoLibsAfterMove(after, mx, my, size) {
  let count = 0;
  const seen = new Set();
  for (const [nx, ny] of neighbors(mx, my, size)) {
    if (after[nx]?.[ny] !== 'O') continue;
    const k = nx * size + ny;
    if (seen.has(k)) continue;
    const chain = traceChain(after, nx, ny, 'O', size);
    for (const [cx, cy] of chain) seen.add(cx * size + cy);
    if (chainLiberties(after, chain, size) === 2) count++;
  }
  return count;
}

