import { Chess } from "chess.js";

const Log = {
  sys: (msg) =>
    console.log(`%c[SYSTEM] ${msg}`, "color: #00bcd4; font-weight: bold;"),
  err: (msg) =>
    console.log(`%c[ERROR] ${msg}`, "color: #f44336; font-weight: bold;"),
};

export class LocalEngineService {
  constructor() {
    this.worker = null;
    this.isReady = false;
    this.jobQueue = [];
    this.isBusy = false;
    this.init();
  }

  async init() {
    Log.sys("Initializing Engine Service...");
    await this._initStockfish();
  }

  async _initStockfish() {
    // Note: Ensure these files are in your extension's public/assets folder
    // and accessible via web_accessible_resources in manifest.json
    const engineUrl = chrome.runtime.getURL("engine/stockfish.js");
    const wasmUrl = chrome.runtime.getURL("engine/stockfish.wasm");

    try {
      const response = await fetch(engineUrl);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      const scriptContent = await response.text();

      // Create a blob to inject the WASM locator logic
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

      // Kickstart UCI
      setTimeout(() => {
        if (this.worker) this.worker.postMessage("uci");
      }, 500);
    } catch (e) {
      Log.err(`Init Failed: ${e.message}`);
    }
  }

  // --- Public API ---

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
    return this._execute(
      `position ${cmdString}`,
      "eval",
      "eval",
      turn,
      playerColor
    );
  }

  // --- Internal Helpers ---

  _preparePosition(movesStr) {
    let cleanMoves = "";
    let turn = "w";

    // 1. Handle FEN
    if (movesStr.includes("/") && movesStr.split(" ").length > 3) {
      cleanMoves = `fen ${movesStr}`;
      const fenParts = movesStr.split(" ");
      turn = fenParts[1] || "w";
    }
    // 2. Handle Move List
    else {
      const translated = this._sanitizeMoves(movesStr);
      if (translated === null && movesStr.length > 0)
        return { cmdString: null, turn: "w" };

      cleanMoves = `startpos moves ${translated}`;

      const moveArray = translated
        .trim()
        .split(/\s+/)
        .filter((m) => m !== "");
      turn = moveArray.length % 2 === 0 ? "w" : "b";
    }
    return { cmdString: cleanMoves, turn };
  }

  _sanitizeMoves(movesStr) {
    if (!movesStr) return "";
    try {
      const game = new Chess();
      const moves = movesStr.trim().split(/\s+/);
      const lanMoves = [];

      for (const move of moves) {
        // Validate and convert to Long Algebraic Notation (LAN)
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

  // --- Worker Messaging & Queue ---

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
    if (this.isBusy || this.jobQueue.length === 0 || !this.isReady) return;

    this.isBusy = true;
    const job = this.jobQueue[0];
    if (job.preCmd) this.worker.postMessage(job.preCmd);
    this.worker.postMessage(job.cmd);
  }

  _onWorkerMessage(e) {
    const data = e.data;
    if (typeof data === "string") {
      data.includes("\n")
        ? data.split("\n").forEach((l) => this._handleLine(l))
        : this._handleLine(data);
    }
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

    // logic: parse bestmove
    if (job.type === "bestmove" && line.startsWith("bestmove")) {
      isDone = true;
      const bestMoveMatch = line.match(/bestmove\s(\w+)/);
      const scoreRegex = /score\s(cp|mate)\s([-\d]+)/g;
      const matches = [...job.buffer.matchAll(scoreRegex)];

      let displayScore = "0.00";
      if (matches.length > 0) {
        const lastMatch = matches.pop();
        const type = lastMatch[1];
        let val = parseInt(lastMatch[2]);

        // Fix Score Perspective
        if (job.turn === "b") val *= -1;
        if (job.playerColor === "black") val *= -1;

        if (type === "mate") {
          displayScore = (val > 0 ? "+" : "-") + "M" + Math.abs(val);
        } else {
          displayScore = (val / 100).toFixed(2);
          if (val > 0) displayScore = "+" + displayScore;
        }
      }

      result = {
        bestMove: bestMoveMatch ? bestMoveMatch[1] : null,
        score: displayScore,
      };
    }
    // logic: parse static eval
    else if (
      job.type === "eval" &&
      (line.includes("Total Evaluation") || line.includes("Final evaluation"))
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
