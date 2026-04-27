/*
 * Gemini Nano Chat - storage.js
 * SPDX-License-Identifier: zlib-acknowledgement
 * Copyright (c) 2026 @thejjw
*/

import { DEFAULTS, BOUNDS, STORAGE_KEYS } from "./constants.js";

function generateId() {
  return crypto.randomUUID();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getStore() {
  return chrome.storage.local;
}

export async function getAll() {
  return getStore().get(null);
}

export async function getSetting(key) {
  const result = await getStore().get(STORAGE_KEYS.SETTINGS);
  const settings = result[STORAGE_KEYS.SETTINGS] || {};
  if (settings[key] !== undefined) return settings[key];
  return DEFAULTS[key] !== undefined ? DEFAULTS[key] : undefined;
}

export async function getAllSettings() {
  const result = await getStore().get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULTS, ...(result[STORAGE_KEYS.SETTINGS] || {}) };
}

export async function setSetting(key, value) {
  const result = await getStore().get(STORAGE_KEYS.SETTINGS);
  const settings = { ...(result[STORAGE_KEYS.SETTINGS] || {}) };

  switch (key) {
    case "maxChats":
      value = clamp(value, BOUNDS.MAX_CHATS.min, BOUNDS.MAX_CHATS.max);
      break;
    case "maxQueuedMessages":
      value = clamp(value, BOUNDS.MAX_QUEUED_MESSAGES.min, BOUNDS.MAX_QUEUED_MESSAGES.max);
      break;
  }

  settings[key] = value;
  await getStore().set({ [STORAGE_KEYS.SETTINGS]: settings });
  return value;
}

export async function resetSettings() {
  await getStore().set({ [STORAGE_KEYS.SETTINGS]: { ...DEFAULTS } });
  return { ...DEFAULTS };
}

export async function getDisclaimerAccepted() {
  const result = await getStore().get(STORAGE_KEYS.DISCLAIMER_ACCEPTED);
  return result[STORAGE_KEYS.DISCLAIMER_ACCEPTED] || false;
}

export async function setDisclaimerAccepted(value) {
  await getStore().set({ [STORAGE_KEYS.DISCLAIMER_ACCEPTED]: value });
}

export async function getModelState() {
  const result = await getStore().get([STORAGE_KEYS.MODEL_STATE, STORAGE_KEYS.DOWNLOAD_PROGRESS]);
  return {
    state: result[STORAGE_KEYS.MODEL_STATE] || "unknown",
    progress: result[STORAGE_KEYS.DOWNLOAD_PROGRESS] || 0,
  };
}

export async function setModelState(state, progress) {
  const update = { [STORAGE_KEYS.MODEL_STATE]: state };
  if (progress !== undefined) {
    update[STORAGE_KEYS.DOWNLOAD_PROGRESS] = progress;
  }
  await getStore().set(update);
}

export async function getChats() {
  const result = await getStore().get(STORAGE_KEYS.CHATS);
  return result[STORAGE_KEYS.CHATS] || [];
}

export async function saveChats(chats) {
  await getStore().set({ [STORAGE_KEYS.CHATS]: chats });
}

export async function createChat(systemPrompt) {
  const settings = await getAllSettings();
  const chats = await getChats();
  const id = generateId();
  const now = new Date().toISOString();

  const chat = {
    id,
    title: "",
    systemPrompt: systemPrompt || settings.defaultSystemPrompt || DEFAULTS.defaultSystemPrompt,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  let updated = [chat, ...chats];

  if (updated.length > settings.maxChats) {
    updated = updated.slice(0, settings.maxChats);
  }

  await saveChats(updated);
  await setActiveChatId(id);
  return chat;
}

export async function updateChat(chatId, updates) {
  const chats = await getChats();
  const index = chats.findIndex((c) => c.id === chatId);
  if (index === -1) return null;

  chats[index] = {
    ...chats[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await saveChats(chats);
  return chats[index];
}

export async function addMessage(chatId, role, content, perfStats = null) {
  const chats = await getChats();
  const index = chats.findIndex((c) => c.id === chatId);
  if (index === -1) return null;

  const message = { role, content, timestamp: new Date().toISOString() };
  if (perfStats) message.perfStats = perfStats;
  chats[index].messages.push(message);
  chats[index].updatedAt = new Date().toISOString();

  if (role === "user") {
    const text = typeof content === "string"
      ? content
      : content.find((p) => p.type === "text")?.value || "Image attachment";
    chats[index].title = text.substring(0, 60);
  }

  await saveChats(chats);
  return message;
}

export async function deleteChat(chatId) {
  const chats = await getChats();
  const filtered = chats.filter((c) => c.id !== chatId);
  await saveChats(filtered);

  const result = await getStore().get(STORAGE_KEYS.ACTIVE_CHAT_ID);
  if (result[STORAGE_KEYS.ACTIVE_CHAT_ID] === chatId) {
    await setActiveChatId(null);
  }
}

export async function getActiveChatId() {
  const result = await getStore().get(STORAGE_KEYS.ACTIVE_CHAT_ID);
  return result[STORAGE_KEYS.ACTIVE_CHAT_ID] || null;
}

export async function setActiveChatId(id) {
  await getStore().set({ [STORAGE_KEYS.ACTIVE_CHAT_ID]: id });
}

export async function pruneChatsToLimit(limit) {
  const chats = await getChats();
  if (chats.length <= limit) return 0;
  const pruned = chats.slice(0, limit);
  await saveChats(pruned);
  return chats.length - pruned.length;
}
