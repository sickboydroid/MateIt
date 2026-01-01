import { CONFIG, STATE } from "./config.js";
import { UI } from "./ui/panel.js";
import { LocalEngineService } from "./services/engine.js";
import { Visuals } from "./utils/visuals.js";
import "./styles.css";

class App {
  constructor() {
    this.lastFen = "";
    this.engine = new LocalEngineService();
    this.ui = new UI(this);
    this.initObserver();
  }

  /** Observes the move list for changes. */
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

  /** Scrapes moves from DOM. */
  getMoves() {
    const nodes = document.querySelectorAll("wc-simple-move-list .node");
    let moves = [];
    nodes.forEach((n) => {
      let text = n.innerText.trim();
      // Handle figurine notation if present
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

    // Check if it is the bot's configured turn
    const isMyTurn =
      (STATE.mode === "white" && isWhite) ||
      (STATE.mode === "black" && !isWhite);

    if (!isMyTurn) return;

    const limitObj = {
      type: STATE.limitType,
      value: STATE.limitType === "depth" ? STATE.depthVal : STATE.timeVal,
    };

    try {
      // 1. Get Best Move
      const bestData = await this.engine.getBestMove(
        limitObj,
        moves,
        STATE.mode
      );

      // 2. Fallback to explicit Eval if score missing
      let score = bestData.score;
      if (!score || score === "0.00") {
        const evalData = await this.engine.getEvaluation(moves, STATE.mode);
        if (evalData && evalData.score !== "0.00") score = evalData.score;
      }

      // 3. Adjust score for Black perspective (Display logic)
      if (STATE.mode === "black") {
        score = (score[0] === "-" ? "+" : "-") + score.substring(1);
      }

      if (bestData && bestData.bestMove) {
        Visuals.drawArrow(bestData.bestMove);
        this.ui.updateInfo(bestData.bestMove, score);
      }
    } catch (err) {
      console.error("Analysis Error:", err);
    }
  }
}

// Bootstrap
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
