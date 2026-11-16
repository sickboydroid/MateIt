import { STATE } from "./config.js";
import { BoardObserver } from "./chess/board.js";
import { UI } from "./ui/panel.js";
import { LocalEngineService } from "./services/engine.js";
import { Visuals } from "./utils/visuals.js";
import "./styles.css";

class App {
  constructor() {
    this.engine = new LocalEngineService();
    this.ui = new UI(this);
    this.view = {};
    this.request = 0;
    new BoardObserver((view) => {
      const previous = this.view;
      this.view = view;
      this.ui.panel.hidden = !view.board;
      if (view.fen !== previous.fen || view.board !== previous.board) this.process();
      else if (view.flipped !== previous.flipped) this.draw();
    });
  }

  onSettingsChange() {
    this.process();
  }

  draw() {
    Visuals.drawArrow(this.view.board, this.result?.bestMove, this.view.flipped);
  }

  async process() {
    const { board, fen } = this.view;
    const mode = STATE.mode;
    const turn = mode === "white" ? "w" : "b";
    const limit = {
      type: STATE.limitType,
      value: STATE.limitType === "depth" ? STATE.depthVal : STATE.timeVal,
    };
    const request = ++this.request;
    this.result = null;
    Visuals.clear();
    this.ui.updateInfo(null, null);
    if (!board || mode === "off" || !fen || fen.split(" ")[1] !== turn) return;

    try {
      const result = await this.engine.getBestMove(limit, fen, mode);
      if (!result || request !== this.request) return;
      this.result = result;
      this.draw();
      this.ui.updateInfo(result.bestMove, result.score);
    } catch (error) {
      if (request === this.request) {
        this.ui.updateInfo("Engine error", null);
        console.warn("MateIt analysis failed", error);
      }
    }
  }
}

new App();
