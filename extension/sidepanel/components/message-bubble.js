export function renderMessageBubble(container, message, isStreaming = false, settings = {}) {
  const isUser = message.role === "user";
  const bubble = document.createElement("div");
  bubble.className = `message-bubble ${isUser ? "user" : "assistant"}`;
  if (isStreaming) bubble.classList.add("streaming");

  let contentHtml = "";

  if (isUser && Array.isArray(message.content)) {
    const textPart = message.content.find((p) => p.type === "text");
    const imageParts = message.content.filter((p) => p.type === "image");
    const audioParts = message.content.filter((p) => p.type === "audio");

    contentHtml += `<div class="message-text">${escapeHtml(textPart?.value || "")}</div>`;

    if (imageParts.length > 0) {
      contentHtml += '<div class="message-attachments">';
      for (const img of imageParts) {
        const src = typeof img.value === "string" && img.value.startsWith("data:")
          ? img.value
          : "";
        if (src) {
          contentHtml += `<img src="${src}" class="attachment-image" alt="Attached image" />`;
        }
      }
      contentHtml += "</div>";
    }

    if (audioParts.length > 0) {
      contentHtml += '<div class="message-attachments">';
      for (const audio of audioParts) {
        contentHtml += `<div class="attachment-audio">🎤 Audio message</div>`;
      }
      contentHtml += "</div>";
    }
  } else {
    const text = typeof message.content === "string" ? message.content : "";
    contentHtml = `<div class="message-text">${formatAssistantText(text)}</div>`;
  }

  let metaHtml = "";
  if (settings.showTimestamp !== false && message.timestamp) {
    const timeString = new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    metaHtml += `<span class="message-time">${timeString}</span>`;
  }
  if (settings.showPerfStats !== false && message.perfStats) {
    const { durationMs, toksPerSec } = message.perfStats;
    metaHtml += `<span class="message-perf">${(durationMs / 1000).toFixed(1)}s • ${toksPerSec} tok/s</span>`;
  }

  bubble.innerHTML = `
    <div class="message-role">
      ${isUser ? "You" : "Gemini Nano"}
      ${metaHtml ? `<div class="message-meta">${metaHtml}</div>` : ""}
    </div>
    ${contentHtml}
    ${!isStreaming ? '<button class="message-copy" title="Copy">📋</button>' : ""}
  `;

  const copyBtn = bubble.querySelector(".message-copy");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const text = typeof message.content === "string"
        ? message.content
        : message.content.find((p) => p.type === "text")?.value || "";
      navigator.clipboard.writeText(text);
      copyBtn.textContent = "✓";
      setTimeout(() => { copyBtn.textContent = "📋"; }, 1500);
    });
  }

  container.appendChild(bubble);
  return bubble;
}

export function updateStreamingBubble(bubble, text) {
  const textEl = bubble.querySelector(".message-text");
  if (textEl) {
    textEl.innerHTML = formatAssistantText(text);
  }
}

export function finalizeStreamingBubble(bubble, perfStats = null, settings = {}) {
  bubble.classList.remove("streaming");
  const copyBtn = document.createElement("button");
  copyBtn.className = "message-copy";
  copyBtn.title = "Copy";
  copyBtn.textContent = "📋";
  copyBtn.addEventListener("click", () => {
    const textEl = bubble.querySelector(".message-text");
    navigator.clipboard.writeText(textEl?.textContent || "");
    copyBtn.textContent = "✓";
    setTimeout(() => { copyBtn.textContent = "📋"; }, 1500);
  });
  bubble.appendChild(copyBtn);

  if (perfStats && settings.showPerfStats !== false) {
    let roleEl = bubble.querySelector(".message-role");
    let metaEl = roleEl.querySelector(".message-meta");
    if (!metaEl) {
      metaEl = document.createElement("div");
      metaEl.className = "message-meta";
      roleEl.appendChild(metaEl);
    }
    const { durationMs, toksPerSec } = perfStats;
    const perfHtml = `<span class="message-perf">${(durationMs / 1000).toFixed(1)}s • ${toksPerSec} tok/s</span>`;
    metaEl.innerHTML += perfHtml;
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatAssistantText(text) {
  let html = escapeHtml(text);
  // Match code blocks even if the closing ``` hasn't streamed in yet
  html = html.replace(/```(\w*)\n([\s\S]*?)(?:```|$)/g, "<pre><code>$2</code></pre>");
  html = html.replace(/`([^`]+)(?:`|$)/g, "<code>$1</code>");
  html = html.replace(/\*\*(.*?)(?:\*\*|$)/g, "<strong>$1</strong>");
  html = html.replace(/\*(?!\s)(.*?)(?<!\s)(?:\*|$)/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/\n/g, "<br>");
  return html;
}
