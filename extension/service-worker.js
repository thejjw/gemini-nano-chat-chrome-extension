/*
 * Gemini Nano Chat - service-worker.js
 * SPDX-License-Identifier: zlib-acknowledgement
 * Copyright (c) 2026 @thejjw
*/

const DEBUG = true;

function dbg(label, ...args) {
  if (DEBUG) console.log(`[DBG][sw][${label}]`, ...args);
}

const OFFSCREEN_URL = "offscreen/offscreen.html";
let offscreenCreating = null;

async function hasOffscreenDocument() {
  const clients = await self.clients.matchAll();
  const exists = clients.some((c) => c.url.endsWith(OFFSCREEN_URL));
  dbg("hasOffscreenDocument", "exists =", exists);
  return exists;
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return;
  if (offscreenCreating) {
    dbg("ensureOffscreenDocument", "waiting for existing creation");
    await offscreenCreating;
    return;
  }
  dbg("ensureOffscreenDocument", "creating offscreen document");
  offscreenCreating = chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["WORKERS"],
    justification: "Needed to download Gemini Nano model via the Prompt API, which is not available in service workers.",
  });
  await offscreenCreating;
  offscreenCreating = null;
  dbg("ensureOffscreenDocument", "offscreen document created");
}

chrome.action.onClicked.addListener(async (tab) => {
  dbg("actionClicked", "tabId =", tab.id);
  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  dbg("onMessage", JSON.stringify({ type: message.type, source: message.source, target: message.target, language: message.language }), "from:", sender.url || sender.id || "unknown");

  // Messages from offscreen → update storage, forward to sidepanel
  if (message.source === "offscreen") {
    dbg("onMessage", "from offscreen, type =", message.type, "state =", message.state);
    switch (message.type) {
      case "MODEL_STATE_UPDATE":
        chrome.storage.local.set({
          modelState: message.state,
          downloadProgress: message.progress || 0,
        }).then(() => {
          dbg("onMessage", "storage updated: modelState =", message.state, "progress =", message.progress);
        });
        chrome.runtime.sendMessage({
          type: "MODEL_STATE_UPDATE",
          state: message.state,
          progress: message.progress || 0,
        }).then(() => {
          dbg("onMessage", "MODEL_STATE_UPDATE forwarded to sidepanel");
        }).catch((e) => {
          dbg("onMessage", "failed to forward MODEL_STATE_UPDATE:", e.message);
        });
        break;

      case "DOWNLOAD_PROGRESS":
        chrome.storage.local.set({ downloadProgress: message.progress });
        chrome.runtime.sendMessage({
          type: "DOWNLOAD_PROGRESS",
          progress: message.progress,
        }).catch((e) => {
          dbg("onMessage", "failed to forward DOWNLOAD_PROGRESS:", e.message);
        });
        break;
    }
    return false;
  }

  // Messages from sidepanel → forward to offscreen
  if (message.type === "START_DOWNLOAD") {
    dbg("onMessage", "START_DOWNLOAD, language =", message.language);
    ensureOffscreenDocument().then(() => {
      dbg("onMessage", "forwarding START_DOWNLOAD to offscreen");
      chrome.runtime.sendMessage({
        target: "offscreen",
        type: "START_DOWNLOAD",
        language: message.language || "en",
      }).then(() => {
        dbg("onMessage", "START_DOWNLOAD sent to offscreen");
      }).catch((e) => {
        dbg("onMessage", "failed to send START_DOWNLOAD to offscreen:", e.message);
      });
    });
    return false;
  }

  if (message.type === "CHECK_AVAILABILITY") {
    dbg("onMessage", "CHECK_AVAILABILITY received");
    ensureOffscreenDocument().then(() => {
      dbg("onMessage", "forwarding CHECK_AVAILABILITY to offscreen");
      chrome.runtime.sendMessage({
        target: "offscreen",
        type: "CHECK_AVAILABILITY",
      }).then(() => {
        dbg("onMessage", "CHECK_AVAILABILITY sent to offscreen");
      }).catch((e) => {
        dbg("onMessage", "failed to send CHECK_AVAILABILITY to offscreen:", e.message);
      });
    });
    return false;
  }

  if (message.type === "CANCEL_DOWNLOAD") {
    chrome.runtime.sendMessage({
      target: "offscreen",
      type: "CANCEL_DOWNLOAD",
    }).catch(() => { });
    return false;
  }

  if (message.type === "RESET_ALL_DATA") {
    chrome.storage.local.clear();
    chrome.runtime.sendMessage({ type: "DATA_RESET" }).catch(() => { });
    sendResponse({ ok: true });
    return false;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  dbg("onInstalled", "initializing storage");
  chrome.storage.local.set({
    disclaimerAccepted: false,
    modelState: "unknown",
    downloadProgress: 0,
  });
});
