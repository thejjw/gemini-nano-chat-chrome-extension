export function renderQueueView(container, queue, onRemove, onReorder, onEdit, onClearAll) {
  if (queue.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="queue-view">
      <div class="queue-header">
        <span>⏳ Queued (${queue.length})</span>
        <button id="queue-clear-all" class="btn btn-secondary btn-sm">Clear All</button>
      </div>
      <div class="queue-items">
        ${queue
          .map(
            (item, i) => `
          <div class="queue-item" data-index="${i}">
            <span class="queue-item-number">${i + 1}</span>
            <div class="queue-item-content">${escapeHtml(getItemText(item))}</div>
            <div class="queue-item-actions">
              ${i > 0 ? `<button class="queue-btn queue-up" data-index="${i}" title="Move up">▲</button>` : ""}
              ${i < queue.length - 1 ? `<button class="queue-btn queue-down" data-index="${i}" title="Move down">▼</button>` : ""}
              <button class="queue-btn queue-edit" data-index="${i}" title="Edit">✏️</button>
              <button class="queue-btn queue-remove" data-index="${i}" title="Remove">✕</button>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;

  container.querySelector("#queue-clear-all")?.addEventListener("click", onClearAll);

  container.querySelectorAll(".queue-remove").forEach((btn) => {
    btn.addEventListener("click", () => onRemove(parseInt(btn.dataset.index, 10)));
  });

  container.querySelectorAll(".queue-up").forEach((btn) => {
    btn.addEventListener("click", () => onReorder(parseInt(btn.dataset.index, 10), parseInt(btn.dataset.index, 10) - 1));
  });

  container.querySelectorAll(".queue-down").forEach((btn) => {
    btn.addEventListener("click", () => onReorder(parseInt(btn.dataset.index, 10), parseInt(btn.dataset.index, 10) + 1));
  });

  container.querySelectorAll(".queue-edit").forEach((btn) => {
    btn.addEventListener("click", () => onEdit(parseInt(btn.dataset.index, 10)));
  });
}

export function renderEditDialog(item, onSave, onCancel) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal queue-edit-modal">
      <h3>Edit Queued Message</h3>
      <textarea id="queue-edit-text" rows="4">${escapeHtml(getItemText(item))}</textarea>
      <div class="modal-actions">
        <button id="queue-edit-cancel" class="btn btn-secondary">Cancel</button>
        <button id="queue-edit-save" class="btn btn-primary">Save</button>
      </div>
    </div>
  `;

  overlay.querySelector("#queue-edit-cancel").addEventListener("click", () => {
    overlay.remove();
    onCancel();
  });

  overlay.querySelector("#queue-edit-save").addEventListener("click", () => {
    const newText = overlay.querySelector("#queue-edit-text").value.trim();
    if (newText) {
      onSave(newText);
    }
    overlay.remove();
  });

  document.body.appendChild(overlay);
}

function getItemText(item) {
  if (typeof item.content === "string") return item.content;
  const textPart = item.content.find((p) => p.type === "text");
  let text = textPart?.value || "";
  const imageCount = item.content.filter((p) => p.type === "image").length;
  const audioCount = item.content.filter((p) => p.type === "audio").length;
  if (imageCount) text += ` [${imageCount} image${imageCount > 1 ? "s" : ""}]`;
  if (audioCount) text += ` [${audioCount} audio]`;
  return text;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
