/*
 * Gemini Nano Chat - sidepanel.js
 * SPDX-License-Identifier: zlib-acknowledgement
 * Copyright (c) 2026 @thejjw
*/

const DEBUG = true;

function dbg(label, ...args) {
  if (DEBUG) console.log(`[DBG][sidepanel][${label}]`, ...args);
}

import { AIManager } from "../lib/ai-manager.js";
import * as storage from "../lib/storage.js";
import { LANGUAGE_NOTE } from "../lib/constants.js";
import { renderVersionError } from "./components/version-error.js";
import { renderDisclaimerModal } from "./components/disclaimer-modal.js";
import { renderDownloadOverlay, updateDownloadProgress } from "./components/download-overlay.js";
import { renderSettingsPanel } from "./components/settings-panel.js";
import { renderChatList } from "./components/chat-list.js";
import { renderChatView } from "./components/chat-view.js";

const appEl = document.getElementById("app");
const mainContent = document.getElementById("main-content");
const header = document.getElementById("app-header");
const settingsBtn = document.getElementById("settings-btn");
const footer = document.getElementById("app-footer");

const aiManager = new AIManager();
let activeChatId = null;
let chatViewActive = false;

init();

async function init() {
  dbg("init", "starting");
  const hasPromptAPI = "LanguageModel" in window;
  dbg("init", "hasPromptAPI =", hasPromptAPI);

  if (!hasPromptAPI) {
    renderVersionError(mainContent);
    settingsBtn.style.display = "none";
    return;
  }

  const disclaimerAccepted = await storage.getDisclaimerAccepted();
  dbg("init", "disclaimerAccepted =", disclaimerAccepted);
  if (!disclaimerAccepted) {
    showDisclaimer();
    return;
  }

  await checkModelAndProceed();
}

function showDisclaimer() {
  dbg("showDisclaimer");
  renderDisclaimerModal(
    appEl,
    async () => {
      dbg("disclaimer", "accepted");
      await storage.setDisclaimerAccepted(true);
      await checkModelAndProceed();
    },
    () => {
      mainContent.innerHTML = '<div class="centered-message"><p>Please accept the disclaimer to use this extension.</p></div>';
    }
  );
}

async function checkModelAndProceed() {
  const modelState = await storage.getModelState();
  dbg("checkModelAndProceed", "modelState =", JSON.stringify(modelState));

  if (modelState.state === "loaded" || modelState.state === "available") {
    dbg("checkModelAndProceed", "model loaded or available, showing chat");
    showChatInterface();
    return;
  }

  if (modelState.state === "unknown") {
    dbg("checkModelAndProceed", "state unknown, sending CHECK_AVAILABILITY");
    chrome.runtime.sendMessage({ type: "CHECK_AVAILABILITY" });
  }

  showDownloadOverlay(modelState);
}

function showDownloadOverlay(modelState) {
  dbg("showDownloadOverlay", "state =", modelState.state);
  settingsBtn.style.display = "none";
  header.querySelector("h1").textContent = "Gemini Nano Chat";

  storage.getSetting("language").then((lang) => {
    dbg("showDownloadOverlay", "language =", lang);
    renderDownloadOverlay(mainContent, modelState, onStartDownload, onCancelDownload, lang || "en");
  });
}

function onStartDownload(language) {
  dbg("onStartDownload", "language =", language);
  storage.setSetting("language", language);
  aiManager.setLanguage(language);
  chrome.runtime.sendMessage({ type: "START_DOWNLOAD", language });
  renderDownloadOverlay(mainContent, { state: "downloading", progress: 0 }, onStartDownload, onCancelDownload, language);
}

function onCancelDownload() {
  dbg("onCancelDownload");
  chrome.runtime.sendMessage({ type: "CANCEL_DOWNLOAD" });
}

chrome.runtime.onMessage.addListener((message, sender) => {
  dbg("onMessage", "received:", JSON.stringify(message), "from:", sender.url || "unknown");

  if (message.type === "MODEL_STATE_UPDATE") {
    if (message.state === "loaded" || message.state === "available") {
      dbg("onMessage", "model loaded/available via message");
      showChatInterface();
    } else if (message.state === "downloading") {
      if (!chatViewActive) {
        showDownloadOverlay({ state: "downloading", progress: message.progress });
      }
    } else if (message.state === "downloadable" || message.state === "unavailable") {
      if (!chatViewActive) {
        showDownloadOverlay({ state: message.state === "unavailable" ? "unavailable" : "downloadable", progress: 0 });
      }
    } else {
      dbg("onMessage", "unhandled state:", message.state, "- treating as downloadable");
      if (!chatViewActive) {
        showDownloadOverlay({ state: "downloadable", progress: 0 });
      }
    }
  }

  if (message.type === "DOWNLOAD_PROGRESS") {
    if (!chatViewActive) {
      updateDownloadProgress(mainContent, message.progress);
    }
  }
});

chrome.storage.onChanged.addListener((changes) => {
  dbg("storageChanged", Object.keys(changes).map((k) => `${k}: ${changes[k].oldValue} -> ${changes[k].newValue}`).join(", "));
  const ms = changes.modelState;
  if (ms && (ms.newValue === "loaded" || ms.newValue === "available") && !chatViewActive) {
    dbg("storageChanged", "model loaded/available via storage, showing chat");
    showChatInterface();
  }
  if (changes.downloadProgress && !chatViewActive) {
    updateDownloadProgress(mainContent, changes.downloadProgress.newValue);
  }
});

async function showChatInterface() {
  dbg("showChatInterface");
  chatViewActive = true;
  settingsBtn.style.display = "inline-block";

  const lang = await storage.getSetting("language");
  aiManager.setLanguage(lang || "en");

  activeChatId = await storage.getActiveChatId();
  dbg("showChatInterface", "activeChatId =", activeChatId);

  let chats = await storage.getChats();
  if (!activeChatId || !chats.some(c => c.id === activeChatId)) {
    if (chats.length === 0) {
      const newChat = await storage.createChat();
      chats.push(newChat);
    }
    activeChatId = chats[0].id;
    await storage.setActiveChatId(activeChatId);
  }

  renderMainLayout();
}

async function renderMainLayout() {
  mainContent.innerHTML = `
    <div class="main-layout">
      <aside class="sidebar" id="sidebar"></aside>
      <main class="content" id="content"></main>
    </div>
  `;

  const sidebar = document.getElementById("sidebar");
  const content = document.getElementById("content");

  await renderChatList(sidebar, activeChatId, onSelectChat, onNewChat, onDeleteChat);
  await loadChatContent(content);
}

async function onSelectChat(chatId) {
  if (chatId === activeChatId) return;
  activeChatId = chatId;
  await storage.setActiveChatId(chatId);
  await aiManager.destroySession();

  const content = document.getElementById("content");
  const sidebar = document.getElementById("sidebar");
  await renderChatList(sidebar, activeChatId, onSelectChat, onNewChat, onDeleteChat);
  await loadChatContent(content);
}

async function onNewChat() {
  const chat = await storage.createChat();
  activeChatId = chat.id;

  const content = document.getElementById("content");
  const sidebar = document.getElementById("sidebar");
  await renderChatList(sidebar, activeChatId, onSelectChat, onNewChat, onDeleteChat);
  await loadChatContent(content);
}

async function onDeleteChat(chatId) {
  if (!confirm("Are you sure you want to delete this chat?")) return;
  const wasActive = (chatId === activeChatId);
  await storage.deleteChat(chatId);

  if (wasActive) {
    await aiManager.destroySession();
    let chats = await storage.getChats();
    if (chats.length === 0) {
      const newChat = await storage.createChat();
      chats.push(newChat);
    }
    activeChatId = chats[0].id;
    await storage.setActiveChatId(activeChatId);
  }

  const content = document.getElementById("content");
  const sidebar = document.getElementById("sidebar");
  if (sidebar && content) {
    await renderChatList(sidebar, activeChatId, onSelectChat, onNewChat, onDeleteChat);
    if (wasActive) {
      await loadChatContent(content);
    }
  }
}

async function loadChatContent(container) {
  if (!activeChatId) {
    container.innerHTML = '<div class="centered-message"><p>Select a chat or create a new one.</p></div>';
    return;
  }

  const chats = await storage.getChats();
  const chat = chats.find((c) => c.id === activeChatId);

  if (!chat) {
    container.innerHTML = '<div class="centered-message"><p>Chat not found.</p></div>';
    return;
  }

  try {
    await aiManager.createSessionForChat(chat);
  } catch (e) {
    container.innerHTML = `<div class="centered-message error"><p>Failed to create session: ${escapeHtml(e.message)}</p></div>`;
    return;
  }

  const settings = await storage.getAllSettings();
  renderChatView(container, chat, aiManager, onChatUpdated, settings);
}

function onChatUpdated() {
  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    renderChatList(sidebar, activeChatId, onSelectChat, onNewChat, onDeleteChat);
  }
}

settingsBtn.addEventListener("click", () => {
  const existing = document.getElementById("settings-overlay");
  if (existing) {
    existing.remove();
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "settings-overlay";
  overlay.className = "settings-overlay-container";
  appEl.appendChild(overlay);

  renderSettingsPanel(overlay, async (changed) => {
    overlay.remove();
    if (changed && chatViewActive) {
      const lang = await storage.getSetting("language");
      aiManager.setLanguage(lang || "en");

      const sidebar = document.getElementById("sidebar");
      if (sidebar) {
        await renderChatList(sidebar, activeChatId, onSelectChat, onNewChat, onDeleteChat);
      }
    }
  });
});

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
