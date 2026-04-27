import * as storage from "../../lib/storage.js";

let isSidebarCollapsed = false;

export async function renderChatList(container, activeChatId, onSelectChat, onNewChat, onDeleteChat) {
  const chats = await storage.getChats();
  const settings = await storage.getAllSettings();

  container.innerHTML = `
    <div class="chat-list">
      <div class="chat-list-header">
        <button id="chat-list-toggle" class="btn-icon chat-list-toggle" title="Toggle chat list">☰</button>
        <h3 id="chat-list-title">Chats</h3>
        <button id="new-chat-btn" class="btn btn-primary btn-sm" title="New Chat">+ New</button>
      </div>
      <div class="chat-list-items ${isSidebarCollapsed ? 'collapsed' : ''}" id="chat-list-items">
        ${chats.length === 0 ? '<p class="chat-list-empty">No chats yet. Start a new one!</p>' : ""}
        ${chats
          .map(
            (chat, i) => `
          <div class="chat-list-item ${chat.id === activeChatId ? "active" : ""}" data-chat-id="${chat.id}">
            <div class="chat-list-item-title">${escapeHtml(chat.title || "New Chat")}</div>
            <button class="chat-list-item-delete" title="Delete chat" data-chat-id="${chat.id}">×</button>
            <div class="chat-list-item-meta">${formatTimeAgo(chat.updatedAt)}${chat.messages.length > 0 ? ` · ${chat.messages.length} msgs` : ""}</div>
            ${
              i === chats.length - 1 && chats.length >= settings.maxChats
                ? '<div class="chat-list-item-warning">Will be deleted when a new chat is created</div>'
                : ""
            }
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;

  const itemsEl = container.querySelector("#chat-list-items");
  const titleEl = container.querySelector("#chat-list-title");
  const toggleBtn = container.querySelector("#chat-list-toggle");

  let overlayEl = container.parentNode.querySelector('.sidebar-overlay');
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.className = 'sidebar-overlay';
    container.parentNode.appendChild(overlayEl);
  }

  overlayEl.onclick = () => {
    isSidebarCollapsed = true;
    container.querySelector("#chat-list-items").classList.add("collapsed");
    overlayEl.classList.remove("active");
  };

  if (isSidebarCollapsed) {
    overlayEl.classList.remove("active");
  } else {
    overlayEl.classList.add("active");
  }

  toggleBtn.addEventListener("click", () => {
    isSidebarCollapsed = !isSidebarCollapsed;
    if (isSidebarCollapsed) {
      itemsEl.classList.add("collapsed");
      overlayEl.classList.remove("active");
    } else {
      itemsEl.classList.remove("collapsed");
      overlayEl.classList.add("active");
    }
  });

  container.querySelector("#new-chat-btn").addEventListener("click", onNewChat);

  container.querySelectorAll(".chat-list-item-delete").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (onDeleteChat) onDeleteChat(el.dataset.chatId);
    });
  });

  container.querySelectorAll(".chat-list-item").forEach((el) => {
    el.addEventListener("click", () => {
      isSidebarCollapsed = true;
      onSelectChat(el.dataset.chatId);
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatTimeAgo(isoString) {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
