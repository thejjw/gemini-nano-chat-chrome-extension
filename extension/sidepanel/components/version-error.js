import { PROMPT_API_URL } from "../../lib/constants.js";

export function renderVersionError(container) {
  container.innerHTML = `
    <div class="version-error">
      <div class="version-error-icon">⚠️</div>
      <h2>Unsupported Browser</h2>
      <p>
        The <strong>Prompt API</strong> (Gemini Nano) is required for this extension.
        It's available in <strong>Chrome 138</strong> or later.
      </p>
      <p>
        Please update your browser or enable the following flags in
        <code>chrome://flags</code>:
      </p>
      <ul>
        <li><code>#optimization-guide-on-device-model</code></li>
        <li><code>#prompt-api-for-gemini-nano-multimodal-input</code></li>
      </ul>
      <p>Then relaunch Chrome and try again.</p>
      <a href="${PROMPT_API_URL}" target="_blank" class="btn-link">
        View Prompt API Documentation
      </a>
    </div>
  `;
}
