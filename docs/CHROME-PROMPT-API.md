# Chrome Prompt API Reference

The Prompt API allows sending natural language requests to Gemini Nano in the browser.

## Use Cases

- **AI-powered search**: Answer questions based on web page content
- **Personalized news feeds**: Dynamically classify articles with categories
- **Custom content filters**: Analyze and blur/hide content based on user topics
- **Calendar event creation**: Extract event details from web pages
- **Contact extraction**: Extract contact information from websites

## Browser Requirements

- **Chromium Version**: Chrome 138+ (Experimental feature), Chrome 148+ (Origin Trials)
- **Local Testing**: May require experimental flags to be enabled (`chrome://flags/#prompt-api-for-gemini-nano`)

## Official Resources & Future Updates
- **Prompt API Docs**: [https://developer.chrome.com/docs/ai/prompt-api](https://developer.chrome.com/docs/ai/prompt-api)
- **Chrome Built-in AI Hub**: [https://developer.chrome.com/docs/ai/](https://developer.chrome.com/docs/ai/)

## Hardware Requirements

### Operating System
- Windows 10 or 11
- macOS 13+ (Ventura and onwards)
- Linux
- ChromeOS (from Platform 16389.0.0 on Chromebook Plus devices)

**Not supported**: Chrome for Android, iOS, ChromeOS on non-Chromebook Plus devices

### Storage
- At least 22 GB free space on volume containing Chrome profile
- Model removed if space falls below 10 GB

### Hardware
- **GPU**: Strictly more than 4 GB VRAM
- **CPU**: 16 GB RAM or more AND 4 CPU cores or more
- Note: Prompt API with audio input requires GPU

### Network
- Unlimited or unmetered connection required for initial model download only
- No data sent to Google or third parties during use
- Model runs locally after download

## Quick Start

### Check Availability
```javascript
const availability = await LanguageModel.availability({
  expectedInputs: [{type: 'text', languages: ['en']}],
  expectedOutputs: [{type: 'text', languages: ['en']}],
});
```

### Create Session
```javascript
const session = await LanguageModel.create({
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      console.log(`Downloaded ${e.loaded * 100}%`);
    });
  },
});
```

### Prompt (Request-based)
```javascript
const result = await session.prompt('Write me a poem!');
console.log(result);
```

### Prompt (Streaming)
```javascript
const stream = session.promptStreaming('Write me an extra-long poem!');
for await (const chunk of stream) {
  console.log(chunk);
}
```

## Session Creation Options

### Initial Prompts
Provide context from previous interactions:
```javascript
const session = await LanguageModel.create({
  initialPrompts: [
    { role: 'system', content: 'You are a helpful and friendly assistant.' },
    { role: 'user', content: 'What is the capital of Italy?' },
    { role: 'assistant', content: 'The capital of Italy is Rome.' },
    { role: 'user', content: 'What language is spoken there?' },
    { role: 'assistant', content: 'The official language of Italy is Italian.' },
  ],
});
```

### Expected Input/Output
```javascript
const session = await LanguageModel.create({
  expectedInputs: [
    { type: "text", languages: ["en", "ja"] },
    { type: "audio" },
    { type: "image" },
  ],
  expectedOutputs: [
    { type: "text", languages: ["ja"] }
  ]
});
```

### Model Parameters (Extensions only)
```javascript
const params = await LanguageModel.params();
// Returns: {defaultTopK: 3, maxTopK: 128, defaultTemperature: 1, maxTemperature: 2}

const session = await LanguageModel.create({
  temperature: Math.max(params.defaultTemperature * 1.2, 2.0),
  topK: params.defaultTopK,
});
```

### Abort Signal
```javascript
const controller = new AbortController();
stopButton.onclick = () => controller.abort();

const session = await LanguageModel.create({
  signal: controller.signal,
});
```

## Multimodal Capabilities

### Supported Audio Input Types
- AudioBuffer
- ArrayBufferView
- ArrayBuffer
- Blob

### Supported Visual Input Types
- HTMLImageElement
- SVGImageElement
- HTMLVideoElement
- HTMLCanvasElement
- ImageBitmap
- OffscreenCanvas
- VideoFrame
- Blob
- ImageData

### Multimodal Example
```javascript
const session = await LanguageModel.create({
  expectedInputs: [
    { type: "text", languages: ["en"] },
    { type: "image" },
    { type: "audio" },
  ],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
});

const imageBlob = await (await fetch("reference-image.jpeg")).blob();
const canvas = document.querySelector("canvas");

const response = await session.prompt([
  {
    role: "user",
    content: [
      { type: "text", value: "Compare these images:" },
      { type: "image", value: imageBlob },
      { type: "image", value: canvas },
    ],
  },
]);
```

## Advanced Features

### Prefix to Guide Response Format
```javascript
const response = await session.prompt([
  {
    role: 'user',
    content: 'Create a TOML character sheet for a gnome barbarian',
  },
  {
    role: 'assistant',
    content: '```toml\n',
    prefix: true,
  },
]);
```

### JSON Schema Constraints
```javascript
const schema = { type: "boolean" };

const result = await session.prompt(
  `Is this post about pottery?\n\n${post}`,
  { responseConstraint: schema }
);
```

With context measurement:
```javascript
const usage = session.measureContextUsage({ responseConstraint: schema });
```

### Append Messages
```javascript
await session.append([
  {
    role: 'user',
    content: [
      { type: 'text', value: `Here's an image.` },
      { type: 'image', value: fileUpload.files[0] },
    ],
  },
]);
```

## Session Management

### Context Window Tracking
```javascript
console.log(`${session.contextUsage}/${session.contextWindow}`);
```

### Context Overflow Detection
```javascript
session.addEventListener("contextoverflow", () => {
  console.log("Context window overflow detected!");
});
```

### Clone Session
```javascript
const clonedSession = await session.clone({
  signal: controller.signal,
});
```

### Destroy Session
```javascript
session.destroy();
```

## Abort Prompts
```javascript
const controller = new AbortController();
stopButton.onclick = () => controller.abort();

const result = await session.prompt('Write me a poem!', {
  signal: controller.signal,
});
```

## Checking Availability for Extensions

The Prompt API provides the `LanguageModel.availability()` method to check if the hardware and environment meet requirements. This is the primary way to verify compatibility.

### Availability Check
```javascript
const availability = await LanguageModel.availability({
  expectedInputs: [{type: 'text', languages: ['en']}],
  expectedOutputs: [{type: 'text', languages: ['en']}],
});
```

### Possible Return Values
- `'unavailable'` - The user's device or requested session options are not supported
- `'downloadable'` - Additional downloads are needed before creating a session
- `'downloading'` - Downloads are ongoing and must complete
- `'available'` - You can create a session immediately

### Practical Extension Example
```javascript
async function checkPromptAPI() {
  const availability = await LanguageModel.availability({
    expectedInputs: [{type: 'text', languages: ['en']}],
    expectedOutputs: [{type: 'text', languages: ['en']}],
  });

  switch (availability) {
    case 'unavailable':
      console.log('Prompt API not supported on this device');
      return false;
    case 'downloadable':
      console.log('Prompt API available, model will download on first use');
      return true;
    case 'downloading':
      console.log('Prompt API model is downloading...');
      return true;
    case 'available':
      console.log('Prompt API ready to use');
      return true;
    default:
      console.log('Prompt API status:', availability);
      return false;
  }
}

// Usage in extension
const isAvailable = await checkPromptAPI();
if (isAvailable) {
  const session = await LanguageModel.create();
}
```

### Monitoring Download Progress
```javascript
const session = await LanguageModel.create({
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      console.log(`Download progress: ${e.loaded * 100}%`);
    });
  },
});
```

### Important Notes
- The `availability()` method abstracts away hardware checks - it handles OS, RAM, VRAM, and storage verification internally
- Always pass the same options to `availability()` that you'll use in `prompt()` or `promptStreaming()`
- For audio input, the API will check for GPU availability automatically
- If `'unavailable'` is returned, the device doesn't meet hardware requirements or the feature is disabled by flags

## Languages
Currently supported: "en", "ja", "es"
Additional languages in development.

## Localhost Setup
Enable these flags:
- `chrome://flags/#optimization-guide-on-device-model`
- `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`

## Permission Policy
```html
<iframe src="https://cross-origin.example.com/" allow="language-model"></iframe>
```

## TypeScript Typings
Install: `npm install @types/dom-chromium-ai`

## Important Notes

- Always pass same options to `availability()` as used in `prompt()` or `promptStreaming()`
- Check for user activation before creating session
- Model downloaded separately on first use per origin
- Prompt API not available in Web Workers
- Default available to top-level windows and same-origin iframes
