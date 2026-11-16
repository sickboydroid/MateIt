import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_POSITION } from "chess.js";
import { LocalEngineService } from "../src/content/services/engine.js";

function event() {
  let listener;
  return {
    addListener(callback) { listener = callback; },
    emit(value) { listener(value); },
  };
}

function fakeRuntime(open) {
  const messages = [];
  const port = {
    onMessage: event(),
    onDisconnect: event(),
    postMessage(message) { messages.push(message); },
  };
  globalThis.chrome = {
    runtime: {
      sendMessage: open,
      connect: () => port,
    },
  };
  return { messages, port };
}

const limit = { type: "depth", value: 8 };
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("only the latest search is sent if the engine is still opening", async () => {
  const opening = Promise.withResolvers();
  const { messages, port } = fakeRuntime(() => opening.promise);
  const engine = new LocalEngineService();

  const first = engine.getBestMove(1, limit, DEFAULT_POSITION);
  engine.cancel();
  const second = engine.getBestMove(2, limit, DEFAULT_POSITION);
  assert.equal(await first, null);
  opening.resolve({ ready: true });
  await flush();
  assert.deepEqual(messages.map(({ type, id }) => [type, id]), [["search", 2]]);

  port.onMessage.emit({ id: 2, bestMove: "e2e4", score: "0.00" });
  assert.deepEqual(await second, { bestMove: "e2e4", score: "0.00" });
});

test("cancels an active search and discards its late response", async () => {
  const { messages, port } = fakeRuntime(async () => ({ ready: true }));
  const engine = new LocalEngineService();

  const first = engine.getBestMove(1, limit, DEFAULT_POSITION);
  await flush();
  engine.cancel();
  const second = engine.getBestMove(2, limit, DEFAULT_POSITION);
  await flush();
  assert.deepEqual(messages.map(({ type, id }) => [type, id]), [
    ["search", 1],
    ["cancel", 1],
    ["search", 2],
  ]);
  assert.equal(await first, null);
  port.onMessage.emit({ id: 1, bestMove: "d2d4", score: "+0.30" });
  port.onMessage.emit({ id: 2, bestMove: "e2e4", score: "0.00" });
  assert.deepEqual(await second, { bestMove: "e2e4", score: "0.00" });
});

test("reconnects after the browser closes the engine connection", async () => {
  let connections = 0;
  const { port } = fakeRuntime(async () => {
    connections++;
    return { ready: true };
  });
  const engine = new LocalEngineService();

  const first = engine.getBestMove(1, limit, DEFAULT_POSITION);
  await flush();
  const rejected = assert.rejects(first, /Stockfish disconnected/);
  port.onDisconnect.emit();
  await rejected;

  const second = engine.getBestMove(2, limit, DEFAULT_POSITION);
  await flush();
  port.onMessage.emit({ id: 2, bestMove: null, score: "-M0" });
  assert.deepEqual(await second, { bestMove: null, score: "-M0" });
  assert.equal(connections, 2);
});
