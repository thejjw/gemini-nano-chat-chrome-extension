/*
 * Gemini Nano Chat - ai-manager.js 
 * SPDX-License-Identifier: zlib-acknowledgement
 * Copyright (c) 2026 @thejjw
*/

import { MESSAGE_ROLES } from "./constants.js";

export class AIManager {
  constructor() {
    this._session = null;
    this._abortController = null;
    this._currentChatId = null;
    this._language = "en";
  }

  setLanguage(lang) {
    this._language = lang;
  }

  getActiveSession() {
    return this._session;
  }

  async createSessionForChat(chat) {
    await this.destroySession();

    this._currentChatId = chat.id;

    const initialPrompts = [];

    if (chat.systemPrompt) {
      initialPrompts.push({
        role: MESSAGE_ROLES.SYSTEM,
        content: chat.systemPrompt,
      });
    }

    let expectedInputs = [
      { type: "text", languages: [this._language] },
      { type: "image" },
      { type: "audio" },
    ];

    console.log("[AIManager] Initializing session. Requesting inputs:", expectedInputs.map(i => i.type));
    try {
      let availability = await LanguageModel.availability({
        expectedInputs,
        expectedOutputs: [{ type: "text", languages: [this._language] }],
      });
      console.log("[AIManager] Audio+Image availability:", availability);
      if (availability === "unavailable" || availability === "no") throw new Error("Audio unsupported");
    } catch (e) {
      console.log("[AIManager] Audio check failed, falling back to Image+Text. Error:", e);
      expectedInputs = [
        { type: "text", languages: [this._language] },
        { type: "image" },
      ];
      try {
        let availability = await LanguageModel.availability({
          expectedInputs,
          expectedOutputs: [{ type: "text", languages: [this._language] }],
        });
        console.log("[AIManager] Image availability:", availability);
        if (availability === "unavailable" || availability === "no") throw new Error("Image unsupported");
      } catch (e2) {
        console.log("[AIManager] Image check failed, falling back to Text only. Error:", e2);
        expectedInputs = [{ type: "text", languages: [this._language] }];
      }
    }
    console.log("[AIManager] Final resolved expectedInputs before creating session:", expectedInputs.map(i => i.type));

    for (const msg of chat.messages) {
      const content = typeof msg.content === "string"
        ? msg.content
        : msg.content.map((part) => {
          if (part.type === "text") return { type: "text", value: part.value };
          if (part.type === "image" || part.type === "audio") {
            const blob = dataUrlToBlob(part.value);
            return { type: part.type, value: blob };
          }
          return part;
        });
      initialPrompts.push({ role: msg.role, content });
    }

    const createOptions = {
      initialPrompts,
      expectedInputs,
      expectedOutputs: [{ type: "text", languages: [this._language] }],
    };

    try {
      console.log("[AIManager] Attempting LanguageModel.create with inputs:", createOptions.expectedInputs.map(i => i.type));
      this._session = await LanguageModel.create(createOptions);
      console.log("[AIManager] Session created successfully.");
    } catch (e) {
      console.error("[AIManager] createSession failed with inputs:", createOptions.expectedInputs.map(i => i.type), e);
      // Fallback if the browser threw an error despite passing the availability check
      if (createOptions.expectedInputs.some(i => i.type === "audio")) {
        createOptions.expectedInputs = createOptions.expectedInputs.filter(i => i.type !== "audio");
        console.log("[AIManager] Falling back createSession without audio...");
        try {
          this._session = await LanguageModel.create(createOptions);
          console.log("[AIManager] Session created successfully without audio.");
        } catch (e2) {
          console.error("[AIManager] createSession failed without audio:", e2);
          createOptions.expectedInputs = createOptions.expectedInputs.filter(i => i.type !== "image");
          console.log("[AIManager] Falling back createSession without image...");
          this._session = await LanguageModel.create(createOptions);
          console.log("[AIManager] Session created successfully without image.");
        }
      } else if (createOptions.expectedInputs.some(i => i.type === "image")) {
        createOptions.expectedInputs = createOptions.expectedInputs.filter(i => i.type !== "image");
        console.log("[AIManager] Falling back createSession without image...");
        this._session = await LanguageModel.create(createOptions);
        console.log("[AIManager] Session created successfully without image.");
      } else {
        console.error("[AIManager] All fallbacks failed.", e);
        throw e;
      }
    }

    this._session.addEventListener("contextoverflow", () => {
      console.warn("Context window overflow — older messages will be dropped.");
    });

    return this._session;
  }

  async sendStreamingMessage(content, onChunk) {
    if (!this._session) throw new Error("No active session");

    this._abortController = new AbortController();

    const stream = this._session.promptStreaming(content, {
      signal: this._abortController.signal,
    });

    for await (const chunk of stream) {
      onChunk(chunk);
    }
  }

  async sendMessage(content) {
    if (!this._session) throw new Error("No active session");

    this._abortController = new AbortController();

    const result = await this._session.prompt(content, {
      signal: this._abortController.signal,
    });

    return result;
  }

  abortGeneration() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  async destroySession() {
    this.abortGeneration();
    if (this._session) {
      try {
        this._session.destroy();
      } catch { }
      this._session = null;
      this._currentChatId = null;
    }
  }

  async cloneSession(signal) {
    if (!this._session) throw new Error("No active session");
    return this._session.clone({ signal });
  }
}

function dataUrlToBlob(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith("data:")) return dataUrl;
  const [meta, data] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)[1];
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
}
