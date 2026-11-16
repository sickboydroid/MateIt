import assert from "node:assert/strict";
import { test } from "node:test";
import { Chess, DEFAULT_POSITION } from "chess.js";
import { JSDOM } from "jsdom";
import { BoardObserver } from "../src/content/chess/board.js";
import { PositionReader } from "../src/content/chess/position.js";
import { Visuals } from "../src/content/utils/visuals.js";

function renderPieces(board, game) {
  board.replaceChildren(...game.board().flat().filter(Boolean).map((piece) => {
    const element = board.ownerDocument.createElement("div");
    const file = piece.square.charCodeAt(0) - 96;
    element.className = `piece ${piece.color}${piece.type} square-${file}${piece.square[1]}`;
    return element;
  }));
}

function gameWith(...moves) {
  const game = new Chess();
  for (const move of moves) game.move(move);
  return game;
}

test("reads the current Chess.com analysis list, including a rewind and figurines", () => {
  const { document } = new JSDOM(`<wc-chess-board></wc-chess-board>
    <wc-move-list>
      <div class="node" data-node="0-0"><span class="node-highlight-content">e4</span></div>
      <div class="node" data-node="0-1"><span class="node-highlight-content">e5</span></div>
      <div class="node" data-node="0-2"><span class="node-highlight-content selected"><span data-figurine="N"></span>f3</span></div>
    </wc-move-list>`).window;
  const board = document.querySelector("wc-chess-board");
  const list = document.querySelector("wc-move-list");
  const position = new PositionReader();

  const current = gameWith("e4", "e5", "Nf3");
  renderPieces(board, current);
  assert.equal(position.read(board, list), current.fen());

  list.querySelector(".selected").classList.remove("selected");
  list.querySelector('[data-node="0-0"] span').classList.add("selected");
  const rewound = gameWith("e4");
  renderPieces(board, rewound);
  assert.equal(position.read(board, list), rewound.fen());
});

test("reads a nested variation from a position already on the page", () => {
  const { document } = new JSDOM(`<wc-chess-board></wc-chess-board>
    <wc-move-list>
      <div data-node="0-0" class="node">e4</div>
      <div data-node="0-1" class="node">e5</div>
      <div data-node="0-2" class="node">Nf3</div>
      <span class="variation-line">
        <span class="inline-move">
          <span class="move-number">2.</span><div data-node="1-0" class="node white-move">d4</div>
        </span>
        <div data-node="1-1" class="node black-move">exd4</div>
        <span class="variation-line">
          <span class="inline-move">
            <span class="move-number">2...</span><div data-node="2-0" class="node black-move"><span class="selected">Nc6</span></div>
          </span>
        </span>
      </span>
    </wc-move-list>`).window;
  const board = document.querySelector("wc-chess-board");
  const game = gameWith("e4", "e5", "d4", "Nc6");
  renderPieces(board, game);
  assert.equal(new PositionReader().read(board, document.querySelector("wc-move-list")), game.fen());
});

test("follows unambiguous legal moves when a move list is absent or stale", () => {
  const { document } = new JSDOM("<chess-board></chess-board><wc-simple-move-list><span class='node'>e4</span></wc-simple-move-list>").window;
  const board = document.querySelector("chess-board");
  const list = document.querySelector("wc-simple-move-list");
  const position = new PositionReader();
  const game = gameWith("e4");
  renderPieces(board, game);
  assert.equal(position.read(board, list), game.fen());
  game.move("c5");
  renderPieces(board, game);
  assert.equal(position.read(board, list), game.fen());
  game.move("Nf3");
  renderPieces(board, game);
  assert.equal(position.read(board, null), game.fen());

  const incomplete = gameWith("d4", "d5");
  renderPieces(board, incomplete);
  assert.equal(new PositionReader().read(board, null), null);
});

test("honors a published FEN and preserves turn and castling rights", () => {
  const { document } = new JSDOM("<wc-chess-board></wc-chess-board>").window;
  const board = document.querySelector("wc-chess-board");
  const fen = "r3k2r/8/8/8/8/8/8/R3K2R b kq - 0 1";
  board.setAttribute("data-fen", fen);
  renderPieces(board, new Chess(fen));
  assert.equal(new PositionReader().read(board, null), fen);
});

test("tracks late board creation, replacement, flipping and removal on one page", async () => {
  const { window } = new JSDOM("<main></main>", { pretendToBeVisual: true });
  const { document } = window;
  Object.assign(globalThis, {
    document,
    Node: window.Node,
    MutationObserver: window.MutationObserver,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    getComputedStyle: window.getComputedStyle.bind(window),
  });
  window.Element.prototype.getClientRects = function () {
    return this.closest("[hidden]") ? [] : [{}];
  };
  let next;
  let updates = 0;
  new BoardObserver((view) => {
    updates++;
    next?.(view);
  });
  const observe = (change) => new Promise((resolve) => {
    next = resolve;
    change();
  });
  try {
    const root = document.querySelector("main");
    const first = document.createElement("wc-chess-board");
    renderPieces(first, new Chess());
    assert.equal((await observe(() => root.append(first))).fen, DEFAULT_POSITION);

    Visuals.drawArrow(first, "e2e4", false);
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    assert.equal(updates, 2, "MateIt's own arrow does not schedule another read");
    assert.equal(first.querySelector("line").getAttribute("y1"), "6.5");

    const second = document.createElement("chess-board");
    const list = document.createElement("wc-simple-move-list");
    list.innerHTML = '<span class="node">d4</span><span class="node">d5</span>';
    const game = gameWith("d4", "d5");
    renderPieces(second, game);
    const view = await observe(() => root.replaceChildren(second, list));
    assert.equal(view.board, second);
    assert.equal(view.fen, game.fen());

    assert.equal((await observe(() => second.classList.add("flipped"))).flipped, true);
    assert.equal((await observe(() => second.remove())).board, null);
  } finally {
    window.close();
  }
});
