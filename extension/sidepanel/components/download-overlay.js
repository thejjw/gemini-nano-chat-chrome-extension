import { SUPPORTED_LANGUAGES } from "../../lib/constants.js";

export function renderDownloadOverlay(container, modelState, onStartDownload, onCancelDownload, savedLanguage) {
  const state = modelState.state || "unknown";
  const isUnknown = state === "unknown";
  const isDownloading = state === "downloading";
  const isDownloadable = state === "downloadable";
  const isUnavailable = state === "unavailable";
  const isLoaded = state === "loaded";
  const progressPercent = Math.round((modelState.progress || 0) * 100);
  const lang = savedLanguage || "en";

  container.innerHTML = `
    <div class="download-overlay">
      <div class="download-icon">🤖</div>
      <h2>Gemini Nano Model</h2>

      ${isUnknown ? `
        <p>Checking model availability...</p>
        <div class="download-spinner"></div>
      ` : ""}

      ${isUnavailable ? `
        <div class="download-error">
          <p>Your device does not meet the hardware requirements for Gemini Nano.</p>
          <p>Please check the hardware requirements and try again.</p>
        </div>
      ` : ""}

      ${isDownloadable ? `
        <p>The Gemini Nano model needs to be downloaded before you can start chatting.</p>
        <p class="download-note">This is a one-time download. No data will be sent to any server.</p>
        <div class="download-language-select">
          <label for="download-language">Output language:</label>
          <select id="download-language">
            ${SUPPORTED_LANGUAGES.map((l) => `<option value="${l.code}" ${l.code === lang ? "selected" : ""}>${l.name}</option>`).join("")}
          </select>
        </div>
        <button id="start-download" class="btn btn-primary">Download Model</button>
      ` : ""}

      ${isDownloading ? `
        <div class="download-progress-container">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <p class="progress-text">${progressPercent}% downloaded</p>
          <p class="download-note">You can close this panel — the download continues in the background.</p>
          <button id="cancel-download" class="btn btn-secondary">Cancel Download</button>
        </div>
      ` : ""}

      ${isLoaded ? `
        <p>Model is ready. Loading chat interface...</p>
      ` : ""}
    </div>
  `;

  const startBtn = container.querySelector("#start-download");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      const langSelect = container.querySelector("#download-language");
      onStartDownload(langSelect ? langSelect.value : "en");
    });
  }

  const cancelBtn = container.querySelector("#cancel-download");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", onCancelDownload);
  }
}

export function updateDownloadProgress(container, progress) {
  const fill = container.querySelector(".progress-fill");
  const text = container.querySelector(".progress-text");
  if (fill) {
    fill.style.width = `${Math.round(progress * 100)}%`;
  }
  if (text) {
    text.textContent = `${Math.round(progress * 100)}% downloaded`;
  }
}
