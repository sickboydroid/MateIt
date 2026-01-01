import { CONFIG } from "../config.js";

export const Visuals = {
  /** Gets the board element from the DOM. */
  getBoard: () =>
    document.querySelector("wc-chess-board") ||
    document.querySelector("chess-board"),

  /** Checks if the board is flipped (black at bottom). */
  isFlipped: () => {
    const b = Visuals.getBoard();
    return b ? b.classList.contains("flipped") : false;
  },

  /** Converts algebraic square (e.g., "e4") to SVG coordinates. */
  getCoords: (sq) => {
    const file = sq.charCodeAt(0) - 97; // 'a' -> 0
    const rank = parseInt(sq[1]) - 1; // '1' -> 0
    const flipped = Visuals.isFlipped();

    // In SVG, (0,0) is top-left.
    return flipped
      ? { x: 7 - file, y: rank } // Black bottom: a1 is (7,0)
      : { x: file, y: 7 - rank }; // White bottom: a1 is (0,7)
  },

  /** Clears existing arrows/annotations. */
  clear: () => {
    const svg = document.getElementById("sf-svg-layer");
    if (svg) svg.innerHTML = "";
  },

  /** Draws an arrow on the board from a move string (e.g., "e2e4"). */
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
      // Basic pointer-events: none ensures clicks pass through to the board
      svg.style.pointerEvents = "none";
      board.appendChild(svg);
    }

    const start = Visuals.getCoords(moveStr.substring(0, 2));
    const end = Visuals.getCoords(moveStr.substring(2, 4));

    // Define Arrowhead Marker
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
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

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M0,0 L0,3 L3,1.5 z");
    path.setAttribute("fill", CONFIG.ARROW_COLOR);
    marker.appendChild(path);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Draw Line
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", start.x + 0.5);
    line.setAttribute("y1", start.y + 0.5);
    line.setAttribute("x2", end.x + 0.5);
    line.setAttribute("y2", end.y + 0.5);
    line.setAttribute("stroke", CONFIG.ARROW_COLOR);
    line.setAttribute("stroke-width", "0.15");
    line.setAttribute("opacity", CONFIG.ARROW_OPACITY);
    line.setAttribute("marker-end", "url(#sf-arrow-head)");
    line.setAttribute("stroke-linecap", "round");

    svg.appendChild(line);
  },
};
