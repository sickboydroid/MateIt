/**
 * =============================================================================
 * STOCKFISH SERVICE (FINAL SCORE FIX)
 * =============================================================================
 */

// 👇 1. Import Chess.js directly
import { Chess } from "chess.js";

const Log = {
  sys: (msg) =>
    console.log(`%c[SYSTEM] ${msg}`, "color: #00bcd4; font-weight: bold;"),
  err: (msg) =>
    console.log(`%c[ERROR] ${msg}`, "color: #f44336; font-weight: bold;"),
  send: () => {},
  recv: () => {},
};

class LocalEngineService {
  constructor() {
    this.worker = null;
    this.isReady = false;
    this.jobQueue = [];
    this.isBusy = false;
    this.init();
  }

  async init() {
    Log.sys("Initializing Service...");
    // 👇 2. No need to check window.Chess anymore
    Log.sys("Chess.js loaded via npm.");
    await this._initStockfish();
  }

  async _initStockfish() {
    // Keep this logic exactly the same for public folder assets
    const engineUrl = chrome.runtime.getURL("engine/stockfish.js");
    const wasmUrl = chrome.runtime.getURL("engine/stockfish.wasm");

    try {
      const response = await fetch(engineUrl);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      const scriptContent = await response.text();

      const blobSource = `
            var Module = {
                locateFile: function(path) {
                    if(path.indexOf('wasm') > -1) return '${wasmUrl}';
                    return path;
                }
            };
            ${scriptContent}
        `;

      const blob = new Blob([blobSource], { type: "application/javascript" });
      this.worker = new Worker(URL.createObjectURL(blob));
      this.worker.onmessage = (e) => this._onWorkerMessage(e);
      this.worker.onerror = (e) => Log.err(`Worker Error: ${e.message}`);
      setTimeout(() => {
        if (this.worker) this.worker.postMessage("uci");
      }, 500);
    } catch (e) {
      Log.err(`Init Failed: ${e.message}`);
    }
  }

  // --- PUBLIC API ---

  async getBestMove(
    limit = { type: "depth", value: 15 },
    moves = "",
    playerColor = "white"
  ) {
    const { cmdString, turn } = this._preparePosition(moves);
    if (!cmdString) return { bestMove: null, score: "0.00" };

    const posCmd = `position ${cmdString}`;
    const goCmd =
      limit.type === "time"
        ? `go movetime ${limit.value}`
        : `go depth ${limit.value}`;

    return this._execute(posCmd, goCmd, "bestmove", turn, playerColor);
  }

  async getEvaluation(moves = "", playerColor = "white") {
    const { cmdString, turn } = this._preparePosition(moves);
    if (!cmdString) return { score: "0.00" };

    const posCmd = `position ${cmdString}`;
    return this._execute(posCmd, "eval", "eval", turn, playerColor);
  }

  // --- HELPER: TURN DETECTION ---

  _preparePosition(movesStr) {
    let cleanMoves = "";
    let turn = "w";

    // CASE A: FEN
    if (movesStr.includes("/") && movesStr.split(" ").length > 3) {
      cleanMoves = `fen ${movesStr}`;
      const fenParts = movesStr.split(" ");
      turn = fenParts[1] || "w";
    }
    // CASE B: Move List
    else {
      const translated = this._sanitizeMoves(movesStr);
      if (translated === null && movesStr.length > 0)
        return { cmdString: null, turn: "w" };

      cleanMoves = `startpos moves ${translated}`;

      const moveArray = translated
        .trim()
        .split(/\s+/)
        .filter((m) => m !== "");
      const count = moveArray.length;

      turn = count % 2 === 0 ? "w" : "b";
    }
    return { cmdString: cleanMoves, turn };
  }

  _sanitizeMoves(movesStr) {
    if (!movesStr) return "";

    // 👇 3. Use new Chess() directly (removed window check)
    try {
      const game = new Chess();
      const moves = movesStr.trim().split(/\s+/);
      const lanMoves = [];
      for (const move of moves) {
        const result = game.move(move);
        if (result) {
          let lan = result.from + result.to;
          if (result.promotion) lan += result.promotion;
          lanMoves.push(lan);
        } else {
          return null;
        }
      }
      return lanMoves.join(" ");
    } catch (e) {
      return null;
    }
  }

  // --- QUEUE & WORKER LOGIC (Unchanged) ---

  _execute(preCmd, mainCmd, type, turn, playerColor) {
    return new Promise((resolve, reject) => {
      if (!this.worker) return reject("Engine worker not initialized");
      this.jobQueue.push({
        preCmd,
        cmd: mainCmd,
        type,
        turn,
        playerColor,
        resolve,
        reject,
        buffer: "",
        done: false,
      });
      this._processQueue();
    });
  }

  _processQueue() {
    if (this.isBusy || this.jobQueue.length === 0) return;
    if (!this.isReady) return;
    this.isBusy = true;
    const job = this.jobQueue[0];
    if (job.preCmd) this.worker.postMessage(job.preCmd);
    this.worker.postMessage(job.cmd);
  }

  _onWorkerMessage(e) {
    let line = e.data;
    if (typeof line !== "string") return;
    if (line.includes("\n"))
      line.split("\n").forEach((l) => this._handleLine(l));
    else this._handleLine(line);
  }

  _handleLine(line) {
    line = line.trim();
    if (!line) return;
    if (line === "uciok") {
      this.isReady = true;
      Log.sys("Engine Ready");
      this._processQueue();
      return;
    }
    if (line === "readyok") return;

    if (this.jobQueue.length === 0) return;
    const job = this.jobQueue[0];
    job.buffer += line + "\n";

    let isDone = false;
    let result = null;

    if (job.type === "bestmove" && line.startsWith("bestmove")) {
      isDone = true;
      const bestMoveMatch = line.match(/bestmove\s(\w+)/);
      const scoreRegex = /score\s(cp|mate)\s([-\d]+)/g;
      const matches = [...job.buffer.matchAll(scoreRegex)];

      let displayScore = "0.00";

      if (matches.length > 0) {
        const lastMatch = matches.pop();
        let type = lastMatch[1];
        let val = parseInt(lastMatch[2]);

        if (job.turn === "b") val = val * -1;
        if (job.playerColor === "black") val = val * -1;

        if (type === "mate") {
          const movesToMate = Math.abs(val);
          const sign = val > 0 ? "+" : "-";
          displayScore = `${sign}M${movesToMate}`;
        } else {
          displayScore = (val / 100).toFixed(2);
          if (val > 0) displayScore = "+" + displayScore;
        }
      }

      result = {
        bestMove: bestMoveMatch ? bestMoveMatch[1] : null,
        score: displayScore,
      };
    } else if (
      job.type === "eval" &&
      (/Total Evaluation[\s\S]+\n$/.test(job.buffer) ||
        line.includes("Final evaluation"))
    ) {
      isDone = true;
      result = { score: "0.00" };
    }

    if (isDone) {
      job.resolve(result);
      this.jobQueue.shift();
      this.isBusy = false;
      this._processQueue();
    }
  }
}

// Make it globally available if your index.js expects it on window (optional with modules, but safe for legacy code)
window.LocalEngineService = LocalEngineService;
