import { BOARD_SELECTOR, LIST_SELECTOR, PositionReader } from "./position.js";

const COMPONENTS = `${BOARD_SELECTOR}, ${LIST_SELECTOR}`;
const attributes = ["class", "hidden", "aria-current", "aria-hidden", "data-fen", "fen", "board-id", "data-figurine"];
const owned = "#sf-panel, #sf-svg-layer";

function isVisible(node) {
  return node.getClientRects().length > 0 && getComputedStyle(node).visibility === "visible";
}

export class BoardObserver {
  constructor(onChange) {
    this.onChange = onChange;
    this.board = null;
    this.list = null;
    this.components = [];
    this.discover = true;
    this.position = new PositionReader();
    this.scopedObserver = new MutationObserver((records) => {
      if (records.some((record) => this.isRelevant(record))) this.schedule();
    });
    this.documentObserver = new MutationObserver((records) => {
      if (records.some((record) => this.componentsChanged(record))) {
        this.discover = true;
        this.schedule();
      }
    });
    this.documentObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "aria-hidden", "board-id", "id"],
    });
    this.update();
  }

  isRelevant(record) {
    const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
    if (target?.closest(owned)) return false;
    if (record.type !== "childList") return true;
    return [...record.addedNodes, ...record.removedNodes].some((node) =>
      node.nodeType !== Node.ELEMENT_NODE || !node.matches(owned)
    );
  }

  componentsChanged(record) {
    if (record.type === "attributes") {
      return this.components.some((component) =>
        (record.target !== this.board || record.attributeName !== "class") &&
        record.target.contains(component)
      );
    }
    if (this.components.some((component) => !component.isConnected)) return true;
    if (this.board?.contains(record.target) || this.list?.contains(record.target)) return false;
    return [...record.addedNodes].some((node) =>
      node.nodeType === Node.ELEMENT_NODE && !node.matches(owned) &&
      (node.matches(COMPONENTS) || node.querySelector(COMPONENTS))
    );
  }

  schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.update();
    });
  }

  findComponents() {
    this.components = [...document.querySelectorAll(COMPONENTS)];
    const boards = this.components.filter((node) => node.matches(BOARD_SELECTOR) && isVisible(node));
    const board = boards.includes(this.board) ? this.board : boards[0] || null;
    const lists = board ? this.components.filter((node) => node.matches(LIST_SELECTOR)) : [];
    const list = lists.find((node) => board.id && node.getAttribute("board-id") === board.id) ||
      (boards.length === 1 ? lists.find((node) => !node.hasAttribute("board-id") && isVisible(node)) : null) ||
      null;

    if (board !== this.board || list !== this.list) {
      if (board !== this.board) this.position.reset();
      this.board = board;
      this.list = list;
      this.scopedObserver.disconnect();
      for (const target of [board, list]) {
        if (target) this.scopedObserver.observe(target, {
          childList: true,
          subtree: true,
          characterData: target === list,
          attributes: true,
          attributeFilter: attributes,
        });
      }
    }
  }

  update() {
    if (this.discover) {
      this.discover = false;
      this.findComponents();
    }
    const { board, list } = this;
    const fen = board && this.position.read(board, list);
    this.onChange({ board, fen, flipped: board?.classList.contains("flipped") || false });
  }
}
