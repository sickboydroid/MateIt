import { Chess, DEFAULT_POSITION } from "chess.js";

export const BOARD_SELECTOR = "wc-chess-board, chess-board";
export const LIST_SELECTOR = "wc-move-list, wc-simple-move-list, wc-vertical-move-list";
const MOVE_SELECTOR = "[data-node], .node";
const START_PLACEMENT = placementOf(DEFAULT_POSITION);

function placementOf(fen) {
  return fen.split(" ", 1)[0];
}

function boardPlacement(board) {
  const squares = new Map();
  for (const piece of board.querySelectorAll(".piece")) {
    const classes = [...piece.classList];
    const square = classes.find((token) => /^square-[1-8]{2}$/.test(token));
    const code = classes.find((token) => /^[wb][pnbrqk]$/.test(token));
    if (!square || !code) continue;
    const key = square.slice(-2);
    if (squares.has(key)) return null;
    squares.set(key, code[0] === "w" ? code[1].toUpperCase() : code[1]);
  }
  const pieces = [...squares.values()];
  if (pieces.filter((piece) => piece === "K").length !== 1 ||
      pieces.filter((piece) => piece === "k").length !== 1) return null;

  return Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: 8 }, (_, file) => squares.get(`${file + 1}${8 - row}`) || "1")
      .join("")
      .replace(/1+/g, (empty) => String(empty.length))
  ).join("/");
}

function notation(node) {
  const content = node.querySelector(".node-highlight-content") || node;
  const figurine = content.querySelector("[data-figurine]")?.getAttribute("data-figurine") || "";
  const text = content.textContent.trim();
  return (figurine && !text.startsWith(figurine) ? figurine + text : text)
    .replace(/[!?]+$/, "");
}

function readLine(list) {
  const nodes = [...(list?.querySelectorAll(MOVE_SELECTOR) || [])];
  const selected = nodes.find((node) =>
    node.matches(".selected, [aria-current='true']") || node.querySelector(".selected, [aria-current='true']")
  );
  const mainLine = nodes.filter((node) => !node.closest(".variation-line"));
  const selectedIndex = mainLine.indexOf(selected);
  let line = selectedIndex < 0 ? mainLine : mainLine.slice(0, selectedIndex + 1);

  const variations = [];
  for (let variation = selected?.closest(".variation-line"); variation;
    variation = variation.parentElement.closest(".variation-line")) {
    variations.unshift(variation);
  }
  for (const variation of variations) {
    const branch = nodes.filter((node) => node.closest(".variation-line") === variation);
    const first = branch[0];
    const numberText = first?.closest(".inline-move")?.querySelector(".move-number")?.textContent;
    const moveNumber = Number.parseInt(numberText, 10);
    if (!moveNumber) return [];
    const start = (moveNumber - 1) * 2 + Number(first.classList.contains("black-move"));
    if (start > line.length) return [];
    const end = branch.indexOf(selected);
    line = line.slice(0, start).concat(end < 0 ? branch : branch.slice(0, end + 1));
  }

  return line.map(notation);
}

export class PositionReader {
  constructor() {
    this.reset();
  }

  reset() {
    this.previous = DEFAULT_POSITION;
    this.moves = [];
    this.positions = [DEFAULT_POSITION];
    this.game = new Chess();
    this.key = null;
    this.fen = null;
  }

  read(board, list) {
    const layout = boardPlacement(board);
    const exposedFen = board.getAttribute("data-fen") || board.getAttribute("fen") || "";
    const moves = readLine(list);
    const key = JSON.stringify([layout, exposedFen, moves]);
    if (key === this.key) return this.fen;
    this.key = key;

    this.fen = this.resolve(layout, exposedFen, moves);
    if (this.fen) this.previous = this.fen;
    return this.fen;
  }

  resolve(layout, exposedFen, moves) {
    if (exposedFen && (!layout || placementOf(exposedFen) === layout)) {
      try {
        return new Chess(exposedFen).fen();
      } catch {
        // Try the move list when the board publishes an invalid FEN.
      }
    }
    if (!layout) return null;

    // Replay only the changed suffix. Keep the earlier positions for navigation.
    let common = 0;
    while (common < moves.length && moves[common] === this.moves[common]) common++;
    while (this.moves.length > common) {
      this.game.undo();
      this.moves.pop();
      this.positions.pop();
    }
    for (const move of moves.slice(common)) {
      try {
        const played = this.game.move(move);
        this.moves.push(move);
        this.positions.push(played.after);
      } catch {
        break;
      }
    }

    const listed = this.positions.at(-1);
    if (moves.length && this.moves.length === moves.length && placementOf(listed) === layout) return listed;
    if (placementOf(this.previous) === layout) return this.previous;

    const known = this.positions.findLast((fen) => placementOf(fen) === layout);
    if (known && layout !== START_PLACEMENT) return known;

    // A board can update without a move list. Only accept an unambiguous legal move.
    const next = new Chess(this.previous).moves({ verbose: true })
      .filter((move) => placementOf(move.after) === layout);
    if (next.length === 1) return next[0].after;
    return layout === START_PLACEMENT ? DEFAULT_POSITION : null;
  }
}
