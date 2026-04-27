import * as storage from "../../lib/storage.js";
import { DEFAULTS, BOUNDS, SUPPORTED_LANGUAGES } from "../../lib/constants.js";

export function renderSettingsPanel(container, onClose) {
  storage.getAllSettings().then((settings) => {
    container.innerHTML = `
      <div class="settings-panel">
        <div class="settings-header">
          <h3>Settings</h3>
          <button id="settings-close" class="btn-icon" title="Close settings">✕</button>
        </div>

        <div class="settings-group">
          <label for="setting-language">Language</label>
          <select id="setting-language">
            ${SUPPORTED_LANGUAGES.map((l) => `<option value="${l.code}" ${l.code === (settings.language || "en") ? "selected" : ""}>${l.name}</option>`).join("")}
          </select>
          <span class="settings-default">Default: English</span>
        </div>

        <div class="settings-group">
          <label for="setting-max-chats">
            Max stored chats
            <span class="settings-range">(${BOUNDS.MAX_CHATS.min}–${BOUNDS.MAX_CHATS.max})</span>
          </label>
          <div class="settings-row">
            <input type="number" id="setting-max-chats" min="${BOUNDS.MAX_CHATS.min}" max="${BOUNDS.MAX_CHATS.max}" value="${settings.maxChats}" />
            <span class="settings-default">Default: ${DEFAULTS.maxChats}</span>
          </div>
        </div>

        <div class="settings-group">
          <label for="setting-max-queue">
            Max queued messages
            <span class="settings-range">(${BOUNDS.MAX_QUEUED_MESSAGES.min}–${BOUNDS.MAX_QUEUED_MESSAGES.max})</span>
          </label>
          <div class="settings-row">
            <input type="number" id="setting-max-queue" min="${BOUNDS.MAX_QUEUED_MESSAGES.min}" max="${BOUNDS.MAX_QUEUED_MESSAGES.max}" value="${settings.maxQueuedMessages}" />
            <span class="settings-default">Default: ${DEFAULTS.maxQueuedMessages}</span>
          </div>
        </div>

        <div class="settings-group">
          <label for="setting-system-prompt">Default system prompt</label>
          <textarea id="setting-system-prompt" rows="3">${settings.defaultSystemPrompt}</textarea>
          <span class="settings-default">Default: ${DEFAULTS.defaultSystemPrompt}</span>
        </div>

        <div class="settings-group settings-checkbox-group">
          <label class="settings-checkbox-label">
            <input type="checkbox" id="setting-show-timestamp" ${settings.showTimestamp !== false ? "checked" : ""} />
            Show timestamp on messages
          </label>
        </div>

        <div class="settings-group settings-checkbox-group">
          <label class="settings-checkbox-label">
            <input type="checkbox" id="setting-show-perf" ${settings.showPerfStats !== false ? "checked" : ""} />
            Show tok/s and process duration
          </label>
        </div>

        <div class="settings-actions">
          <button id="settings-reset" class="btn btn-secondary">Reset to Defaults</button>
          <button id="settings-save" class="btn btn-primary">Save</button>
        </div>

        <div class="settings-divider"></div>

        <div class="settings-danger-zone">
          <h4>Danger Zone</h4>
          <p>Clear all extension data: chats, settings, and model state. The downloaded model itself is managed by Chrome and cannot be removed from here.</p>
          <button id="settings-reset-all" class="btn btn-danger">Reset All Data</button>
        </div>
      </div>
    `;

    container.querySelector("#settings-close").addEventListener("click", onClose);

    container.querySelector("#settings-save").addEventListener("click", async () => {
      const language = container.querySelector("#setting-language").value;
      const maxChats = parseInt(container.querySelector("#setting-max-chats").value, 10);
      const maxQueuedMessages = parseInt(container.querySelector("#setting-max-queue").value, 10);
      const defaultSystemPrompt = container.querySelector("#setting-system-prompt").value.trim();
      const showTimestamp = container.querySelector("#setting-show-timestamp").checked;
      const showPerfStats = container.querySelector("#setting-show-perf").checked;

      if (defaultSystemPrompt) {
        await storage.setSetting("defaultSystemPrompt", defaultSystemPrompt);
      }
      await storage.setSetting("language", language);
      await storage.setSetting("showTimestamp", showTimestamp);
      await storage.setSetting("showPerfStats", showPerfStats);
      const actualMaxChats = await storage.setSetting("maxChats", maxChats);
      await storage.setSetting("maxQueuedMessages", maxQueuedMessages);

      const pruned = await storage.pruneChatsToLimit(actualMaxChats);
      if (pruned > 0) {
        alert(`${pruned} old chat(s) removed to fit the new limit.`);
      }

      onClose(true);
    });

    container.querySelector("#settings-reset").addEventListener("click", async () => {
      await storage.resetSettings();
      onClose(true);
    });

    container.querySelector("#settings-reset-all").addEventListener("click", () => {
      if (confirm("This will delete ALL your chats, settings, and reset the extension to its initial state. The downloaded model is managed by Chrome and will not be removed.\n\nContinue?")) {
        chrome.runtime.sendMessage({ type: "RESET_ALL_DATA" }, () => {
          onClose(true);
          window.location.reload();
        });
      }
    });
  });
}
