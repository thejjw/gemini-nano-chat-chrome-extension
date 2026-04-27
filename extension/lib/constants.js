/*
 * Gemini Nano Chat - constants.js
 * SPDX-License-Identifier: zlib-acknowledgement
 * Copyright (c) 2026 @thejjw
*/

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "ja", name: "Japanese" },
];

export const DEFAULTS = {
  maxChats: 10,
  maxQueuedMessages: 5,
  defaultSystemPrompt: "You are a helpful, friendly assistant.",
  language: "en",
  showTimestamp: true,
  showPerfStats: true,
};

export const BOUNDS = {
  MAX_CHATS: { min: 1, max: 50 },
  MAX_QUEUED_MESSAGES: { min: 1, max: 20 },
};

export const PROMPT_API_URL = "https://developer.chrome.com/docs/ai/prompt-api";

export const LANGUAGE_NOTE = "From Chrome 140, Gemini Nano supports English, Spanish, and Japanese for input and output text.";

export const MODEL_STATES = {
  UNKNOWN: "unknown",
  UNAVAILABLE: "unavailable",
  DOWNLOADABLE: "downloadable",
  DOWNLOADING: "downloading",
  AVAILABLE: "available",
};

export const STORAGE_KEYS = {
  DISCLAIMER_ACCEPTED: "disclaimerAccepted",
  MODEL_STATE: "modelState",
  DOWNLOAD_PROGRESS: "downloadProgress",
  SETTINGS: "settings",
  CHATS: "chats",
  ACTIVE_CHAT_ID: "activeChatId",
};

export const MESSAGE_ROLES = {
  SYSTEM: "system",
  USER: "user",
  ASSISTANT: "assistant",
};

export const ATTACHMENT_TYPES = {
  IMAGE: "image",
  AUDIO: "audio",
};
