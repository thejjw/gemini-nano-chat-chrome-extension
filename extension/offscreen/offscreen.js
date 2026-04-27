/*
 * Gemini Nano Chat - offscreen.js
 * SPDX-License-Identifier: zlib-acknowledgement
 * Copyright (c) 2026 @thejjw
*/

const DEBUG = true;

function dbg(label, ...args) {
  if (DEBUG) console.log(`[DBG][offscreen][${label}]`, ...args);
}

let downloadController = null;

function sendToBackground(type, data = {}) {
  dbg("sendToBackground", type, JSON.stringify(data));
  chrome.runtime.sendMessage({
    source: "offscreen",
    type,
    ...data,
  }).then(() => {
    dbg("sendToBackground", type, "sent successfully");
  }).catch((e) => {
    dbg("sendToBackground", type, "FAILED:", e.message);
  });
}

async function checkAvailability() {
  dbg("checkAvailability", "LanguageModel in self?", "LanguageModel" in self);

  if (!("LanguageModel" in self)) {
    dbg("checkAvailability", "LanguageModel NOT available");
    sendToBackground("MODEL_STATE_UPDATE", { state: "unavailable", progress: 0 });
    return "unavailable";
  }

  try {
    dbg("checkAvailability", "calling LanguageModel.availability()...");
    const availability = await LanguageModel.availability({
      expectedInputs: [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
    });
    dbg("checkAvailability", "raw result =", availability);
    sendToBackground("MODEL_STATE_UPDATE", { state: availability, progress: availability === "available" ? 1 : 0 });
    return availability;
  } catch (e) {
    dbg("checkAvailability", "ERROR:", e.message, e.stack);
    sendToBackground("MODEL_STATE_UPDATE", { state: "unavailable", progress: 0 });
    return "unavailable";
  }
}

async function startDownload(language) {
  dbg("startDownload", "language =", language);
  if (downloadController) {
    downloadController.abort();
  }
  downloadController = new AbortController();

  sendToBackground("MODEL_STATE_UPDATE", { state: "downloading", progress: 0 });

  try {
    dbg("startDownload", "calling LanguageModel.create()...");
    const session = await LanguageModel.create({
      signal: downloadController.signal,
      expectedInputs: [{ type: "text", languages: [language] }],
      expectedOutputs: [{ type: "text", languages: [language] }],
      monitor(m) {
        dbg("startDownload", "monitor attached");
        m.addEventListener("downloadprogress", (e) => {
          dbg("startDownload", "progress =", e.loaded);
          sendToBackground("DOWNLOAD_PROGRESS", { progress: e.loaded });
        });
      },
    });

    dbg("startDownload", "download complete, destroying session");
    sendToBackground("MODEL_STATE_UPDATE", { state: "loaded", progress: 1 });
    session.destroy();
    downloadController = null;
  } catch (e) {
    dbg("startDownload", "ERROR:", e.name, e.message);
    if (e.name === "AbortError") {
      sendToBackground("MODEL_STATE_UPDATE", { state: "downloadable", progress: 0 });
    } else {
      sendToBackground("MODEL_STATE_UPDATE", { state: "downloadable", progress: 0 });
    }
    downloadController = null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== "offscreen") return;

  dbg("onMessage", "received:", JSON.stringify(message));

  switch (message.type) {
    case "CHECK_AVAILABILITY":
      dbg("onMessage", "handling CHECK_AVAILABILITY");
      checkAvailability().then((result) => {
        dbg("onMessage", "CHECK_AVAILABILITY result =", result);
        sendResponse(result);
      });
      return true;

    case "START_DOWNLOAD":
      dbg("onMessage", "handling START_DOWNLOAD, language =", message.language);
      startDownload(message.language || "en")
        .then(() => {
          dbg("onMessage", "START_DOWNLOAD completed");
          sendResponse({ ok: true });
        })
        .catch((e) => {
          dbg("onMessage", "START_DOWNLOAD error:", e.message);
          sendResponse({ ok: false, error: e.message });
        });
      return true;

    case "CANCEL_DOWNLOAD":
      dbg("onMessage", "handling CANCEL_DOWNLOAD");
      if (downloadController) {
        downloadController.abort();
        downloadController = null;
      }
      sendResponse({ ok: true });
      return false;
  }
});

dbg("init", "offscreen loaded, running initial availability check");
checkAvailability();
