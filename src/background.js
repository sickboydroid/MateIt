let opening;

async function openEngineDocument() {
  const url = chrome.runtime.getURL("src/engine/offscreen.html");
  if (opening) return opening;

  opening = (async () => {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [url],
    });
    if (!contexts.length) {
      await chrome.offscreen.createDocument({
        url,
        reasons: ["WORKERS"],
        justification: "Run the bundled Stockfish worker for board analysis.",
      });
    }
  })();

  try {
    await opening;
  } finally {
    opening = null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "mateit-open-engine" || !sender.tab) return;
  openEngineDocument().then(
    () => respond({ ready: true }),
    (error) => respond({ error: error.message }),
  );
  return true;
});
