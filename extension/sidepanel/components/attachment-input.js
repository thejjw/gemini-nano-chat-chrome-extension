export function renderAttachmentInput(container, onAttach) {
  container.innerHTML = `
    <div class="attachment-input">
      <button id="attach-image" class="btn-icon" title="Attach image">🖼️</button>
      <button id="attach-audio" class="btn-icon" title="Attach audio / record">🎤</button>
    </div>
    <div class="attachment-preview" id="attachment-preview"></div>
    <input type="file" id="image-file-input" accept="image/*" style="display:none" />
    <input type="file" id="audio-file-input" accept="audio/*" style="display:none" />
  `;

  const attachments = [];
  let mediaRecorder = null;
  let audioChunks = [];

  const previewEl = container.querySelector("#attachment-preview");

  function renderPreviews() {
    previewEl.innerHTML = attachments
      .map(
        (a, i) => `
        <div class="attachment-chip" data-index="${i}">
          ${a.type === "image" ? `<img src="${a.dataUrl}" class="chip-thumb" />` : '<span class="chip-audio">🎤 Audio</span>'}
          <button class="chip-remove" data-index="${i}">✕</button>
        </div>
      `
      )
      .join("");

    previewEl.querySelectorAll(".chip-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        attachments.splice(parseInt(btn.dataset.index, 10), 1);
        renderPreviews();
        onAttach(attachments.slice());
      });
    });

    onAttach(attachments.slice());
  }

  container.querySelector("#attach-image").addEventListener("click", () => {
    container.querySelector("#image-file-input").click();
  });

  container.querySelector("#image-file-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    attachments.push({ type: "image", dataUrl, file });
    renderPreviews();
    e.target.value = "";
  });

  const audioBtn = container.querySelector("#attach-audio");
  audioBtn.addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      audioBtn.textContent = "🎤";
      audioBtn.title = "Attach audio / record";
      return;
    }

    const hasAudioFile = confirm("OK to record from microphone.\nCancel to pick an audio file.");
    if (!hasAudioFile) {
      container.querySelector("#audio-file-input").click();
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunks, { type: "audio/webm" });
        const dataUrl = await blobToDataUrl(blob);
        attachments.push({ type: "audio", dataUrl, blob });
        renderPreviews();
      };
      mediaRecorder.start();
      audioBtn.textContent = "⏹️";
      audioBtn.title = "Stop recording";
    }).catch(() => {
      container.querySelector("#audio-file-input").click();
    });
  });

  container.querySelector("#audio-file-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    attachments.push({ type: "audio", dataUrl, file });
    renderPreviews();
    e.target.value = "";
  });

  return {
    getAttachments: () => attachments.slice(),
    clearAttachments: () => {
      attachments.length = 0;
      renderPreviews();
    },
    addAttachment: async (file) => {
      if (!file) return;
      const type = file.type.startsWith("audio/") ? "audio" : "image";
      const dataUrl = await readFileAsDataUrl(file);
      attachments.push({ type, dataUrl, file });
      renderPreviews();
    }
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}
