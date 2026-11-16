function formatScore(type, value) {
  if (type === "mate") return `${value > 0 ? "+" : "-"}M${Math.abs(value)}`;
  return `${value > 0 ? "+" : ""}${(value / 100).toFixed(2)}`;
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "mateit-engine" || !port.sender.tab) return;

  let worker;
  let ready = false;
  let job;
  let timer;
  let score;

  function stopWorker() {
    clearTimeout(timer);
    worker?.terminate();
    worker = null;
    ready = false;
    job = null;
  }

  function fail(error) {
    const id = job?.id;
    stopWorker();
    if (id !== undefined) port.postMessage({ id, error });
  }

  function search() {
    clearTimeout(timer);
    const { fen, limit } = job;
    const timeLimited = limit.type === "time";
    timer = setTimeout(() => fail("Stockfish search timed out"), timeLimited ? limit.value + 5000 : 120000);
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go ${timeLimited ? "movetime" : "depth"} ${limit.value}`);
  }

  function onLine(line) {
    if (line === "uciok") {
      ready = true;
      if (job) search();
      return;
    }
    if (!job) return;

    const evaluation = line.match(/^info .*\bscore (cp|mate) (-?\d+)\b/);
    if (evaluation) score = formatScore(evaluation[1], Number(evaluation[2]));

    const result = line.match(/^bestmove\s+(\S+)/);
    if (result) {
      const move = result[1];
      const bestMove = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move) ? move : null;
      port.postMessage({ id: job.id, bestMove, score });
      clearTimeout(timer);
      job = null;
    }
  }

  port.onMessage.addListener((message) => {
    if (message.type === "cancel") {
      if (job?.id === message.id) stopWorker();
      return;
    }
    if (message.type !== "search") return;
    if (job) stopWorker();
    job = message;
    score = "0.00";

    if (ready) {
      search();
      return;
    }

    try {
      const current = new Worker(chrome.runtime.getURL("engine/stockfish.js"));
      worker = current;
      current.onmessage = ({ data }) => {
        if (current === worker && typeof data === "string") {
          for (const line of data.split("\n")) onLine(line.trim());
        }
      };
      current.onerror = (event) => {
        if (current === worker) fail(event.message || "Stockfish worker failed");
      };
      timer = setTimeout(() => fail("Stockfish startup timed out"), 10000);
      current.postMessage("uci");
    } catch (error) {
      fail(error.message);
    }
  });

  port.onDisconnect.addListener(stopWorker);
});
