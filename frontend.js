(function () {
  "use strict";

  const CONFIG = {
    STARTUP_DELAY: 1500,
  };

  const STATE = {
    mode: "off",
    limitType: "depth",
    depthVal: 15,
    timeVal: 2000,
    isCollapsed: false,
  };

  // ===========================================================================
  // UTILS: VISUALS (Unchanged)
  // ===========================================================================
  const Visuals = {
    getBoard: () =>
      document.querySelector("wc-chess-board") ||
      document.querySelector("chess-board"),

    isFlipped: () => {
      const b = Visuals.getBoard();
      return b ? b.classList.contains("flipped") : false;
    },

    getCoords: (sq) => {
      const file = sq.charCodeAt(0) - 97;
      const rank = parseInt(sq[1]) - 1;
      const flipped = Visuals.isFlipped();
      return flipped ? { x: 7 - file, y: rank } : { x: file, y: 7 - rank };
    },

    clear: () => {
      const svg = document.getElementById("sf-svg-layer");
      if (svg) svg.innerHTML = "";
    },

    drawArrow: (moveStr) => {
      Visuals.clear();
      if (!moveStr) return;

      const board = Visuals.getBoard();
      if (!board) return;

      let svg = document.getElementById("sf-svg-layer");
      if (!svg) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.id = "sf-svg-layer";
        svg.setAttribute("viewBox", "0 0 8 8");
        svg.setAttribute("preserveAspectRatio", "none");
        board.appendChild(svg);
      }

      const start = Visuals.getCoords(moveStr.substring(0, 2));
      const end = Visuals.getCoords(moveStr.substring(2, 4));

      const COLOR = "#ff073a";
      const OPACITY = "1.0";

      // Marker
      const defs = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "defs"
      );
      const marker = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "marker"
      );
      marker.setAttribute("id", "sf-arrow-head");
      marker.setAttribute("markerWidth", "3");
      marker.setAttribute("markerHeight", "3");
      marker.setAttribute("refX", "1.5");
      marker.setAttribute("refY", "1.5");
      marker.setAttribute("orient", "auto");

      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      path.setAttribute("d", "M0,0 L0,3 L3,1.5 z");
      path.setAttribute("fill", COLOR);
      marker.appendChild(path);
      defs.appendChild(marker);
      svg.appendChild(defs);

      // Line
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line.setAttribute("x1", start.x + 0.5);
      line.setAttribute("y1", start.y + 0.5);
      line.setAttribute("x2", end.x + 0.5);
      line.setAttribute("y2", end.y + 0.5);
      line.setAttribute("stroke", COLOR);
      line.setAttribute("stroke-width", "0.15");
      line.setAttribute("opacity", OPACITY);
      line.setAttribute("marker-end", "url(#sf-arrow-head)");
      line.setAttribute("stroke-linecap", "round");

      svg.appendChild(line);
    },
  };

  // ===========================================================================
  // UI CONTROLLER (Unchanged)
  // ===========================================================================
  class UI {
    constructor(app) {
      this.app = app;
      this.render();
    }

    render() {
      const div = document.createElement("div");
      div.id = "sf-panel";
      div.innerHTML = `
        <div id="sf-header">
            <span id="sf-title">STOCKFISH LOCAL</span>
            <button class="sf-icon-btn active" id="sf-pin-btn" title="Toggle Auto-Collapse">📌</button>
        </div>

        <div id="sf-content">
            <div class="sf-section">
                <div class="sf-mode-group">
                    <button class="sf-mode-btn active-off" data-mode="off">OFF</button>
                    <button class="sf-mode-btn" data-mode="white">WHITE</button>
                    <button class="sf-mode-btn" data-mode="black">BLACK</button>
                </div>
            </div>

            <div class="sf-section">
                <div class="sf-row">
                    <label class="sf-limit-wrap">
                        <input type="radio" name="limitType" value="depth" class="sf-radio" checked>
                        <span class="sf-label">Depth</span>
                    </label>
                    <input type="number" id="sf-depth-in" class="sf-input" value="${STATE.depthVal}" min="1" max="60">
                </div>

                <div class="sf-row">
                    <label class="sf-limit-wrap">
                        <input type="radio" name="limitType" value="time" class="sf-radio">
                        <span class="sf-label">Time (ms)</span>
                    </label>
                    <input type="number" id="sf-time-in" class="sf-input" value="${STATE.timeVal}" step="100" disabled>
                </div>
            </div>

            <hr style="border:0; border-top:1px solid #333; margin:15px 0;">

            <div class="sf-section">
                <div class="sf-row">
                    <span class="sf-label">Best Move</span>
                    <span id="sf-best-display">-</span>
                </div>

                <div id="sf-eval-container">
                    <div id="sf-eval-text">0.00</div>
                    <div id="sf-eval-fill"></div>
                </div>
            </div>
        </div>
      `;
      document.body.appendChild(div);
      this.bindEvents(div);
    }

    bindEvents(panel) {
      const header = panel.querySelector("#sf-header");
      let isDragging = false,
        startX,
        startY;

      header.addEventListener("mousedown", (e) => {
        if (e.target.closest("button")) return;
        isDragging = true;
        startX = e.clientX - panel.offsetLeft;
        startY = e.clientY - panel.offsetTop;
        header.style.cursor = "grabbing";
      });

      window.addEventListener("mouseup", () => {
        isDragging = false;
        header.style.cursor = "grab";
      });

      window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        panel.style.left = `${e.clientX - startX}px`;
        panel.style.top = `${e.clientY - startY}px`;
      });

      const inputs = panel.querySelectorAll("input");
      inputs.forEach((inp) => {
        inp.addEventListener("mousedown", (e) => e.stopPropagation());
      });

      const pinBtn = document.getElementById("sf-pin-btn");
      pinBtn.addEventListener("click", () => {
        STATE.isCollapsed = !STATE.isCollapsed;
        if (STATE.isCollapsed) {
          panel.classList.add("sf-collapsed");
          pinBtn.classList.remove("active");
          pinBtn.innerText = "🔽";
        } else {
          panel.classList.remove("sf-collapsed");
          pinBtn.classList.add("active");
          pinBtn.innerText = "📌";
        }
      });

      const radios = document.getElementsByName("limitType");
      const depthIn = document.getElementById("sf-depth-in");
      const timeIn = document.getElementById("sf-time-in");

      radios.forEach((r) =>
        r.addEventListener("change", (e) => {
          STATE.limitType = e.target.value;
          if (STATE.limitType === "depth") {
            depthIn.disabled = false;
            timeIn.disabled = true;
          } else {
            depthIn.disabled = true;
            timeIn.disabled = false;
          }
        })
      );

      depthIn.addEventListener(
        "change",
        (e) => (STATE.depthVal = parseInt(e.target.value))
      );
      timeIn.addEventListener(
        "change",
        (e) => (STATE.timeVal = parseInt(e.target.value))
      );

      const modeBtns = panel.querySelectorAll(".sf-mode-btn");
      modeBtns.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const mode = e.target.getAttribute("data-mode");
          STATE.mode = mode;
          modeBtns.forEach((b) => {
            b.className = "sf-mode-btn";
            if (b === e.target) {
              b.classList.add(mode === "off" ? "active-off" : "active-on");
            }
          });
          this.app.onModeChange(mode);
        });
      });
    }

    updateInfo(move, score) {
      document.getElementById("sf-best-display").innerText = move || "-";
      const bar = document.getElementById("sf-eval-fill");
      const txt = document.getElementById("sf-eval-text");
      let percent = 50;
      let displayScore = "0.00";
      if (score && score.includes("M")) {
        percent = score.includes("-") ? 0 : 100;
        displayScore = score;
      } else {
        const val = parseFloat(score || 0);
        displayScore = (val > 0 ? "+" : "") + val;
        percent = (1 / (1 + Math.exp(-0.5 * val))) * 100;
      }
      if (STATE.mode == "black")
        displayScore =
          (displayScore[0] == "-" ? "+" : "-") + displayScore.substring(1);
      txt.innerText = displayScore;
      bar.style.width = `${percent}%`;
    }
  }

  // ===========================================================================
  // MAIN APPLICATION
  // ===========================================================================
  class App {
    constructor() {
      this.lastFen = "";
      // Initialize the Local Engine (from engine.js)
      this.engine = new window.LocalEngineService();
      this.ui = new UI(this);
      this.initObserver();
    }

    initObserver() {
      const checkLoop = setInterval(() => {
        const list = document.querySelector("wc-simple-move-list");
        if (list) {
          clearInterval(checkLoop);
          const obs = new MutationObserver(() => this.process());
          obs.observe(list, {
            childList: true,
            subtree: true,
            characterData: true,
          });
        }
      }, 1000);
    }

    onModeChange(mode) {
      Visuals.clear();
      if (mode !== "off") {
        this.lastFen = "FORCE_UPDATE";
        this.process();
      }
    }

    getMoves() {
      const nodes = document.querySelectorAll("wc-simple-move-list .node");
      let moves = [];
      nodes.forEach((n) => {
        let text = n.innerText.trim();
        const fig = n.querySelector("[data-figurine]");
        if (fig) text = fig.getAttribute("data-figurine") + text;
        if (text) moves.push(text);
      });
      return moves.join(" ");
    }

    async process() {
      if (STATE.mode === "off") return;
      Visuals.clear();

      const moves = this.getMoves();
      if (moves === this.lastFen && moves !== "") return;
      this.lastFen = moves;

      const moveArr = moves.split(" ").filter((x) => x);
      const isWhite = moveArr.length % 2 === 0;
      const isMyTurn =
        (STATE.mode === "white" && isWhite) ||
        (STATE.mode === "black" && !isWhite);

      if (!isMyTurn) return;

      // -----------------------------------------------------
      // CHANGED: Use local engine methods instead of fetch
      // -----------------------------------------------------
      const limitObj = {
        type: STATE.limitType,
        value: STATE.limitType === "depth" ? STATE.depthVal : STATE.timeVal,
      };

      try {
        // 1. Get Best Move (and extract score from analysis info)
        // Pass STATE.mode ("white" or "black") as the 3rd argument
        const bestData = await this.engine.getBestMove(
          limitObj,
          moves,
          STATE.mode
        );
        // 2. Try explicit eval, but fallback to bestMove score
        // We lower the timeout for eval so it doesn't block if unsupported
        let score = bestData.score; // Start with score from analysis

        if (!score || score === "0.00") {
          const evalData = await this.engine.getEvaluation(moves);
          if (evalData && evalData.score !== "0.00") score = evalData.score;
        }

        if (STATE.mode == "black")
          score = (score[0] == "-" ? "+" : "-") + score.substring(1);
        if (bestData && bestData.bestMove) {
          Visuals.drawArrow(bestData.bestMove);
          this.ui.updateInfo(bestData.bestMove, score);
        }
      } catch (err) {
        console.error("Analysis Error:", err);
      }
    }
  }

  // Robust Starter
  function start() {
    setTimeout(() => new App(), CONFIG.STARTUP_DELAY);
  }

  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    start();
  } else {
    window.addEventListener("load", start);
  }
})();
