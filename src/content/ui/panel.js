import { STATE } from "../config.js";
import { Visuals } from "../utils/visuals.js";

export class UI {
  constructor(app) {
    this.app = app; // Reference to Main App for callbacks
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
    // 1. Dragging Logic
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

    // 2. State & Inputs
    const depthIn = document.getElementById("sf-depth-in");
    const timeIn = document.getElementById("sf-time-in");

    panel
      .querySelectorAll("input")
      .forEach((i) =>
        i.addEventListener("mousedown", (e) => e.stopPropagation())
      );

    // Pin/Collapse
    const pinBtn = document.getElementById("sf-pin-btn");
    pinBtn.addEventListener("click", () => {
      STATE.isCollapsed = !STATE.isCollapsed;
      panel.classList.toggle("sf-collapsed", STATE.isCollapsed);
      pinBtn.innerText = STATE.isCollapsed ? "🔽" : "📌";
      pinBtn.classList.toggle("active", !STATE.isCollapsed);
    });

    // Limit Type (Depth vs Time)
    document.getElementsByName("limitType").forEach((r) =>
      r.addEventListener("change", (e) => {
        STATE.limitType = e.target.value;
        const isDepth = STATE.limitType === "depth";
        depthIn.disabled = !isDepth;
        timeIn.disabled = isDepth;
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

    // 3. Mode Switching
    const modeBtns = panel.querySelectorAll(".sf-mode-btn");
    modeBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const mode = e.target.getAttribute("data-mode");
        STATE.mode = mode;

        // Update UI classes
        modeBtns.forEach((b) => {
          b.className = "sf-mode-btn";
          if (b === e.target)
            b.classList.add(mode === "off" ? "active-off" : "active-on");
        });

        // Notify App
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
      // Sigmoid function for visual bar
      percent = (1 / (1 + Math.exp(-0.5 * val))) * 100;
    }

    // In black mode, we might want to flip the visual sign logic for the user
    // (Existing logic: If user is black, flip sign for display)
    if (STATE.mode === "black") {
      displayScore =
        (displayScore[0] === "-" ? "+" : "-") + displayScore.substring(1);
    }

    txt.innerText = displayScore;
    bar.style.width = `${percent}%`;
  }
}
