import * as storage from "../../lib/storage.js";
import { renderMessageBubble, updateStreamingBubble, finalizeStreamingBubble } from "./message-bubble.js";
import { renderQueueView, renderEditDialog } from "./queue-view.js";
import { renderAttachmentInput } from "./attachment-input.js";

export function renderChatView(container, chat, aiManager, onChatUpdated, settings = {}) {
  const queue = [];
  let isGenerating = false;

  container.innerHTML = `
    <div class="chat-view">
      <div class="chat-messages" id="chat-messages"></div>
      <div id="queue-container"></div>
      <div class="context-usage" id="context-usage"></div>
      <div class="chat-input-area">
        <div id="attachment-area"></div>
        <div class="chat-input-row">
          <textarea id="chat-input" placeholder="Type a message..." rows="1"></textarea>
          <button id="send-btn" class="btn btn-primary btn-sm" title="Send">➤</button>
          <button id="stop-btn" class="btn btn-secondary btn-sm" style="display:none" title="Stop">⏹</button>
        </div>
      </div>
    </div>
  `;

  const messagesEl = container.querySelector("#chat-messages");
  const inputEl = container.querySelector("#chat-input");
  const sendBtn = container.querySelector("#send-btn");
  const stopBtn = container.querySelector("#stop-btn");
  const queueContainer = container.querySelector("#queue-container");
  const contextUsageEl = container.querySelector("#context-usage");
  const attachmentArea = container.querySelector("#attachment-area");

  const attachmentHandler = renderAttachmentInput(attachmentArea, () => {});
  if (!aiManager.multimodalSupported) {
    attachmentArea.style.opacity = "0.5";
    attachmentArea.querySelectorAll('button, input').forEach(el => el.style.pointerEvents = 'none');
    attachmentArea.title = "The device doesn't currently support multimodal mode according to browser.";
    attachmentArea.style.cursor = "not-allowed";
  }

  chat.messages.forEach((msg) => renderMessageBubble(messagesEl, msg, false, settings));
  scrollToBottom();

  updateContextUsage();

  async function updateContextUsage() {
    const session = aiManager.getActiveSession();
    if (session) {
      contextUsageEl.textContent = `Context: ${session.contextUsage}/${session.contextWindow} tokens`;
    } else {
      contextUsageEl.textContent = "";
    }
  }

  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  inputEl.addEventListener("paste", (e) => {
    if (!aiManager.multimodalSupported) return;
    const items = (e.clipboardData || window.clipboardData).items;
    if (!items) return;
    
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          attachmentHandler.addAttachment(file);
        }
      }
    }
  });

  sendBtn.addEventListener("click", sendMessage);
  stopBtn.addEventListener("click", () => aiManager.abortGeneration());

  async function sendMessage() {
    const text = inputEl.value.trim();
    const attachments = attachmentHandler.getAttachments();

    if (!text && attachments.length === 0) return;

    const settings = await storage.getAllSettings();

    if (isGenerating) {
      if (queue.length >= settings.maxQueuedMessages) {
        alert(`Queue full (${settings.maxQueuedMessages}/${settings.maxQueuedMessages}). Wait for responses or clear queued messages.`);
        return;
      }
      queue.push(buildMessage(text, attachments));
      attachmentHandler.clearAttachments();
      inputEl.value = "";
      inputEl.style.height = "auto";
      renderQueue();
      return;
    }

    const message = buildMessage(text, attachments);
    attachmentHandler.clearAttachments();
    inputEl.value = "";
    inputEl.style.height = "auto";

    await processMessage(message);
  }

  async function processMessage(message) {
    isGenerating = true;
    sendBtn.style.display = "none";
    stopBtn.style.display = "inline-block";

    renderMessageBubble(messagesEl, message);
    scrollToBottom();

    await storage.addMessage(chat.id, message.role, message.content);
    onChatUpdated();

    const responseBubble = renderMessageBubble(
      messagesEl,
      { role: "assistant", content: "", timestamp: new Date().toISOString() },
      true,
      settings
    );
    scrollToBottom();

    try {
      let fullResponse = "";
      const startTime = Date.now();
      const session = aiManager.getActiveSession();
      const startUsage = session ? session.contextUsage : 0;

      const promptContent = buildPromptContent(message);
      await aiManager.sendStreamingMessage(promptContent, (chunk) => {
        fullResponse += chunk;
        updateStreamingBubble(responseBubble, fullResponse);
        scrollToBottom();
      });

      const endTime = Date.now();
      const durationMs = endTime - startTime;
      const endUsage = session ? session.contextUsage : 0;
      const tokensUsed = endUsage - startUsage;

      let perfStats = null;
      if (durationMs > 0 && tokensUsed > 0) {
        perfStats = {
          durationMs,
          tokensUsed,
          toksPerSec: (tokensUsed / (durationMs / 1000)).toFixed(1)
        };
      }

      finalizeStreamingBubble(responseBubble, perfStats, settings);
      await storage.addMessage(chat.id, "assistant", fullResponse, perfStats);
      onChatUpdated();

      updateContextUsage();
    } catch (e) {
      if (e.name !== "AbortError") {
        updateStreamingBubble(responseBubble, `Error: ${e.message}`);
        finalizeStreamingBubble(responseBubble);
      }
    }

    isGenerating = false;
    sendBtn.style.display = "inline-block";
    stopBtn.style.display = "none";

    if (queue.length > 0) {
      const next = queue.shift();
      renderQueue();
      await processMessage(next);
    }
  }

  function buildMessage(text, attachments) {
    if (attachments.length === 0) {
      return { role: "user", content: text, timestamp: new Date().toISOString() };
    }
    const parts = [];
    if (text) parts.push({ type: "text", value: text });
    for (const a of attachments) {
      parts.push({
        type: a.type,
        value: a.dataUrl,
      });
    }
    return { role: "user", content: parts, timestamp: new Date().toISOString() };
  }

  function buildPromptContent(message) {
    if (typeof message.content === "string") {
      return message.content;
    }
    const contentParts = message.content.map((part) => {
      if (part.type === "text") return { type: "text", value: part.value };
      if (part.type === "image") {
        const blob = dataUrlToBlob(part.value);
        return { type: "image", value: blob };
      }
      if (part.type === "audio") {
        const blob = dataUrlToBlob(part.value);
        return { type: "audio", value: blob };
      }
      return part;
    });
    return [{ role: message.role, content: contentParts }];
  }

  function dataUrlToBlob(dataUrl) {
    const [meta, data] = dataUrl.split(",");
    const mime = meta.match(/:(.*?);/)[1];
    const binary = atob(data);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    return new Blob([array], { type: mime });
  }

  function renderQueue() {
    renderQueueView(
      queueContainer,
      queue,
      (index) => {
        queue.splice(index, 1);
        renderQueue();
      },
      (from, to) => {
        const [item] = queue.splice(from, 1);
        queue.splice(to, 0, item);
        renderQueue();
      },
      (index) => {
        const item = queue[index];
        renderEditDialog(
          item,
          (newText) => {
            if (typeof queue[index].content === "string") {
              queue[index].content = newText;
            } else {
              const textPart = queue[index].content.find((p) => p.type === "text");
              if (textPart) textPart.value = newText;
            }
            renderQueue();
          },
          () => {}
        );
      },
      () => {
        queue.length = 0;
        renderQueue();
      }
    );
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }
}
