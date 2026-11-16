export class LocalEngineService {
  async connect() {
    if (this.port) return this.port;
    if (this.opening) return this.opening;

    this.opening = (async () => {
      const response = await chrome.runtime.sendMessage({ type: "mateit-open-engine" });
      if (!response?.ready) throw new Error(response?.error || "Could not open Stockfish");

      const port = chrome.runtime.connect({ name: "mateit-engine" });
      this.port = port;
      port.onMessage.addListener(({ id, error, bestMove, score }) => {
        if (this.job?.id !== id) return;
        const job = this.job;
        this.job = null;
        if (error) job.reject(new Error(error));
        else job.resolve({ bestMove, score });
      });
      port.onDisconnect.addListener(() => {
        const message = chrome.runtime.lastError?.message;
        if (port !== this.port) return;
        this.port = null;
        this.job?.reject(new Error(message || "Stockfish disconnected"));
        this.job = null;
      });
      return port;
    })();

    try {
      return await this.opening;
    } finally {
      this.opening = null;
    }
  }

  cancel() {
    const job = this.job;
    if (!job) return;
    this.job = null;
    job.resolve(null);
    this.port?.postMessage({ type: "cancel", id: job.id });
  }

  getBestMove(id, limit, fen) {
    return new Promise((resolve, reject) => {
      const job = { id, resolve, reject };
      this.job = job;
      this.connect().then((port) => {
        if (this.job === job) port.postMessage({ type: "search", id, limit, fen });
      }).catch((error) => {
        if (this.job === job) {
          this.job = null;
          reject(error);
        }
      });
    });
  }
}
