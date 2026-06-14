// index.js — Event Chronicle SillyTavern Extension Main Entry
// =============================================================================
// This file is require()'d by SillyTavern's extension loader.
// It registers lifecycle hooks for auto-extraction, memory injection,
// and exposes a window.EventChronicle API for settings/UI pages.
// =============================================================================

const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXTENSION_NAME = 'event-chronicle';

const DEFAULT_SETTINGS = {
  extractTriggerCount: 10,
  mergeTriggerCount: 5,
  overrideMaxTokens: 2048,
  batchSliceSize: 5,
  llmOverride: {
    provider: '',
    model: '',
    apiKey: '',
    baseUrl: '',
    temperature: 0,
    maxTokens: 2048,
  },
};

// ---------------------------------------------------------------------------
// Internal State
// ---------------------------------------------------------------------------

let sdkReady = false;
let messageCount = 0;
let pluginDataDir = null;
let ecBridge = null;
let currentSettings = { ...DEFAULT_SETTINGS };

// ---------------------------------------------------------------------------
// Helpers: SillyTavern API Access
// ---------------------------------------------------------------------------

/**
 * Read extension settings from ST's storage.
 * ST auto-persists settings.html form inputs.
 */
function loadSettings() {
  try {
    // ST stores settings in a global `extension_settings` object
    if (typeof extension_settings !== 'undefined' && extension_settings[EXTENSION_NAME]) {
      return extension_settings[EXTENSION_NAME];
    }
  } catch (e) { /* not in ST context */ }

  // Fallback: read from local JSON file (for dev/testing outside ST)
  const settingsPath = path.join(__dirname, 'data', 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch (e) { /* corrupted */ }
  }
  return null;
}

/**
 * Save extension settings.
 */
function saveSettings(settings) {
  currentSettings = settings;

  // In ST context, settings are auto-persisted via the settings.html form.
  // We also save locally for redundancy and dev testing.
  try {
    const settingsPath = path.join(__dirname, 'data', 'settings.json');
    if (!fs.existsSync(path.dirname(settingsPath))) {
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) { /* non-fatal */ }
}

/**
 * Get merged settings: saved ∪ defaults.
 */
function getMergedSettings() {
  const saved = loadSettings() || {};
  const merged = { ...DEFAULT_SETTINGS, ...saved };
  // Deep-merge llmOverride
  merged.llmOverride = { ...DEFAULT_SETTINGS.llmOverride, ...(saved.llmOverride || {}) };
  return merged;
}

// ---------------------------------------------------------------------------
// Helpers: ST → SDK Type Conversion
// ---------------------------------------------------------------------------

/**
 * Build LLMConfig from extension settings, falling back to ST's global config.
 */
function buildLLMConfig(settings) {
  const override = settings.llmOverride || {};

  // Attempt to read from ST globals (varies by ST version)
  let stProvider = 'openai';
  let stBaseUrl = 'https://api.openai.com/v1';
  let stApiKey = '';
  let stModel = 'gpt-4o';

  try {
    // ST often stores API settings in these globals
    if (typeof oai_settings !== 'undefined') {
      stBaseUrl = oai_settings.reverse_proxy || stBaseUrl;
      stModel = oai_settings.model || stModel;
    }
    if (typeof main_api !== 'undefined') {
      stProvider = main_api || stProvider;
    }
    // API key often comes from secrets.js or env
    if (typeof SECRET_KEYS !== 'undefined' && SECRET_KEYS.OPENAI) {
      stApiKey = SECRET_KEYS.OPENAI;
    }
  } catch (e) { /* not in ST, use defaults */ }

  // Also check process.env
  stApiKey = stApiKey || process.env.OPENAI_API_KEY || '';

  return {
    provider: override.provider || stProvider,
    baseUrl: override.baseUrl || stBaseUrl,
    apiKey: override.apiKey || stApiKey,
    model: override.model || stModel,
    temperature: override.temperature ?? 0,
    maxTokens: override.maxTokens || settings.overrideMaxTokens || 2048,
  };
}

/**
 * Get current chat ID from ST context.
 */
function getCurrentChatId() {
  try {
    // ST exposes chat context via getContext()
    if (typeof getContext === 'function') {
      const ctx = getContext();
      if (ctx && ctx.chatId) return String(ctx.chatId);
    }
    // Some ST versions store it on window
    if (typeof window !== 'undefined' && window.chat_id) {
      return String(window.chat_id);
    }
    // Fallback: derive from character name
    if (typeof getContext === 'function') {
      const ctx = getContext();
      if (ctx && ctx.name2) return String(ctx.name2);
    }
  } catch (e) { /* fall through */ }
  // Absolute fallback
  return 'default';
}

/**
 * Get recent chat messages from ST and convert to SDK ChatMessage format.
 * @returns {Array<{role: string, content: string}>}
 */
function getRecentChatMessages() {
  try {
    if (typeof getContext === 'function') {
      const ctx = getContext();
      if (ctx && Array.isArray(ctx.chat)) {
        return ctx.chat.map(msg => ({
          role: msg.name || (msg.is_user ? 'user' : 'assistant'),
          content: msg.mes || '',
        }));
      }
    }
  } catch (e) { /* fall through */ }
  return [];
}

/**
 * Show a toast notification in ST (if toastr is available).
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {string} message
 */
function showToast(type, message) {
  try {
    if (typeof toastr !== 'undefined') {
      toastr[type]('[Event Chronicle] ' + message);
    }
  } catch (e) {
    // Fallback: console
    const prefix = '[Event Chronicle]';
    if (type === 'error') console.error(prefix, message);
    else if (type === 'warning') console.warn(prefix, message);
    else console.log(prefix, message);
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

async function init() {
  // 1. Determine data directory
  pluginDataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(pluginDataDir)) {
    fs.mkdirSync(pluginDataDir, { recursive: true });
  }

  // 2. Load ec-bridge
  ecBridge = require('./lib/ec-bridge');

  // 3. Load settings (merged with defaults)
  currentSettings = getMergedSettings();
  saveSettings(currentSettings);

  // 4. Build LLM config
  const llmConfig = buildLLMConfig(currentSettings);

  if (!llmConfig.apiKey) {
    console.warn('[Event Chronicle] No API key configured. Extension will be idle.');
    console.warn('[Event Chronicle] Set LLM_API_KEY in .env or configure in extension settings.');
    showToast('warning', '未配置 API 密钥。请在扩展设置中配置。');
    sdkReady = false;
    return;
  }

  // 5. Initialize SDK
  try {
    const promptsDir = path.join(__dirname, 'vendor', 'event-chronicle', 'prompts');
    await ecBridge.init({
      llmConfig,
      dataDir: pluginDataDir,
      promptsDir: promptsDir,
      healthCheck: false, // Don't block ST startup on health check
    });
    sdkReady = true;
    console.log('[Event Chronicle] Initialized successfully');
    console.log(`[Event Chronicle] Provider: ${llmConfig.provider}, Model: ${llmConfig.model}`);
    console.log(`[Event Chronicle] Data dir: ${pluginDataDir}`);
  } catch (err) {
    console.error('[Event Chronicle] Init failed:', err.message);
    sdkReady = false;
    showToast('error', '初始化失败: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle: onChatChanged — Event Extraction Trigger
// ---------------------------------------------------------------------------

function onChatChanged() {
  if (!sdkReady || !ecBridge) return;

  messageCount++;
  const threshold = currentSettings.extractTriggerCount || 10;

  if (messageCount >= threshold) {
    triggerExtraction();
    messageCount = 0;
  }
}

async function triggerExtraction() {
  const chatId = getCurrentChatId();
  if (!chatId) return;

  const messages = getRecentChatMessages();
  if (!messages || messages.length === 0) return;

  try {
    // Only use recent messages (last N where N = extractTriggerCount * 2)
    const recentMessages = messages.slice(-(currentSettings.extractTriggerCount * 2));

    const result = await ecBridge.processMessages(recentMessages, {
      eventId: chatId,
      autoMerge: true,
    });

    if (result.events.length > 0) {
      console.log(`[Event Chronicle] Extracted ${result.events.length} events (chat: ${chatId})`);
    }
    if (result.merged) {
      console.log(`[Event Chronicle] Auto-merge triggered: ${result.mergedEvents?.length} events total`);
    }
  } catch (err) {
    console.error('[Event Chronicle] Extraction failed:', err.message);
    showToast('error', '事件提取失败: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// Memory Injection (core logic, shared by both hook styles)
// ---------------------------------------------------------------------------

/**
 * Build the chronicle memory prompt for the current chat.
 * Returns empty string if SDK not ready or no events exist.
 */
function buildMemoryPrompt() {
  if (!sdkReady || !ecBridge) return '';

  try {
    const chatId = getCurrentChatId();
    if (!chatId) return '';

    return ecBridge.getMemory(chatId, {
      highlightThreshold: 6,
      groupBy: 'location',
    });
  } catch (err) {
    console.error('[Event Chronicle] Memory build failed:', err.message);
    return '';
  }
}

/**
 * Inject memory prompt into generation data.
 * Modifies data in-place. Handles both ST's generate_interceptor format
 * and the older event hook format.
 */
function injectMemoryIntoData(data) {
  const memory = buildMemoryPrompt();
  if (!memory || !memory.trim()) return;

  // Method 1: Insert as system message (modern ST versions)
  if (data && Array.isArray(data.messages)) {
    const existingIdx = data.messages.findIndex(
      m => m.role === 'system' && m.content && m.content.includes('Event Chronicle Memory')
    );
    if (existingIdx >= 0) {
      data.messages[existingIdx].content = memory;
    } else {
      data.messages.unshift({ role: 'system', content: memory });
    }
    return;
  }

  // Method 2: Prepend to prompt string (older ST versions)
  if (data && typeof data.prompt === 'string') {
    data.prompt = memory + '\n\n' + data.prompt;
    return;
  }
}

// ---------------------------------------------------------------------------
// generate_interceptor (ST manifest: "generate_interceptor": "ecGenerateInterceptor")
// ---------------------------------------------------------------------------

/**
 * Global generate interceptor — ST calls this before each text generation.
 * This is registered via manifest.json's `generate_interceptor` field.
 * Must be accessible in the global scope.
 */
function ecGenerateInterceptor(data) {
  try {
    injectMemoryIntoData(data);
  } catch (err) {
    // Non-fatal: let generation proceed without memory
    console.error('[Event Chronicle] Memory injection failed:', err.message);
  }
}

// Expose globally for ST to find
if (typeof globalThis !== 'undefined') {
  globalThis.ecGenerateInterceptor = ecGenerateInterceptor;
}
if (typeof window !== 'undefined') {
  window.ecGenerateInterceptor = ecGenerateInterceptor;
}

// ---------------------------------------------------------------------------
// Lifecycle: onGenerate — Memory Injection (event hook fallback)
// ---------------------------------------------------------------------------

/**
 * Fallback hook for ST versions that use eventSource instead of generate_interceptor.
 */
function onGenerate(data) {
  try {
    injectMemoryIntoData(data);
  } catch (err) {
    console.error('[Event Chronicle] Memory injection failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle: onChatDeleted — Cleanup
// ---------------------------------------------------------------------------

function onChatDeleted(chatId) {
  if (!chatId) return;
  // Optional: archive or delete chronicle data for deleted chat
  console.log(`[Event Chronicle] Chat deleted: ${chatId} (data preserved)`);
}

// ---------------------------------------------------------------------------
// Lifecycle: onSettingsChanged — Re-init when settings change
// ---------------------------------------------------------------------------

function onSettingsChanged() {
  const newSettings = getMergedSettings();

  // Check if LLM config changed
  const oldLLM = currentSettings.llmOverride || {};
  const newLLM = newSettings.llmOverride || {};
  const llmChanged =
    oldLLM.provider !== newLLM.provider ||
    oldLLM.model !== newLLM.model ||
    oldLLM.apiKey !== newLLM.apiKey ||
    oldLLM.baseUrl !== newLLM.baseUrl ||
    currentSettings.overrideMaxTokens !== newSettings.overrideMaxTokens;

  currentSettings = newSettings;
  saveSettings(newSettings);

  if (llmChanged && ecBridge) {
    const llmConfig = buildLLMConfig(newSettings);
    ecBridge.reinit({ llmConfig }).then(() => {
      sdkReady = true;
      console.log('[Event Chronicle] Re-initialized with new LLM config');
      showToast('success', 'LLM 配置已更新');
    }).catch(err => {
      sdkReady = false;
      console.error('[Event Chronicle] Re-init failed:', err.message);
      showToast('error', '更新 LLM 配置失败: ' + err.message);
    });
  }

  // Reset message counter when threshold changes
  messageCount = 0;
}

// ---------------------------------------------------------------------------
// Expose API for Settings Panel & Timeline UI
// ---------------------------------------------------------------------------

const EventChronicleAPI = {
  // Status
  isReady: () => sdkReady,

  // Settings
  getSettings: () => currentSettings,
  onSettingsChanged,

  // Event data
  getEvents: (chatId) => ecBridge ? ecBridge.getEvents(chatId || getCurrentChatId()) : [],
  getAllEvents: () => ecBridge ? ecBridge.getAllEvents() : [],
  updateEvent: (chatId, event) => ecBridge ? ecBridge.updateEvent(chatId, event) : null,
  deleteEvent: (chatId, eventId) => ecBridge ? ecBridge.deleteEvent(chatId, eventId) : false,

  // Memory
  exportMemory: (chatId, opts) => ecBridge ? ecBridge.getMemory(chatId || getCurrentChatId(), opts) : '',

  // Batch
  startBatchGeneration: (options) => ecBridge ? ecBridge.startBatchGeneration({
    ...options,
    chatId: options.chatId || getCurrentChatId(),
  }) : null,
  getBatchProgress: (chatId) => ecBridge ? ecBridge.getBatchProgress(chatId || getCurrentChatId()) : null,

  // Manual trigger
  triggerExtraction: () => triggerExtraction(),
  getCurrentChatId,
};

// Attach to global scope for settings.html and timeline.html to access
if (typeof globalThis !== 'undefined') {
  globalThis.EventChronicle = EventChronicleAPI;
}
if (typeof window !== 'undefined') {
  window.EventChronicle = EventChronicleAPI;
}

// Also export for require() access
module.exports = EventChronicleAPI;

// ---------------------------------------------------------------------------
// Hook Registration
// ---------------------------------------------------------------------------

/**
 * Register ST lifecycle hooks.
 * SillyTavern uses an event system: eventSource.on(event_types.X, handler)
 */
function registerHooks() {
  // Check for ST's event system
  const hasEventSource = typeof eventSource !== 'undefined' && typeof eventSource.on === 'function';
  const hasEventTypes = typeof event_types !== 'undefined';

  if (hasEventSource && hasEventTypes) {
    // Standard ST event API
    if (event_types.CHAT_CHANGED) {
      eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    }
    if (event_types.GENERATE_BEFORE_INPUTS) {
      eventSource.on(event_types.GENERATE_BEFORE_INPUTS, onGenerate);
    }
    if (event_types.CHAT_DELETED) {
      eventSource.on(event_types.CHAT_DELETED, onChatDeleted);
    }
    if (event_types.SETTINGS_LOADED) {
      eventSource.on(event_types.SETTINGS_LOADED, () => {
        // Settings panel is now in DOM — our settings.js handles its own init
      });
    }
    console.log('[Event Chronicle] Hooks registered via eventSource');
    return;
  }

  // Fallback: direct assignment on global hook object (older ST)
  if (typeof window !== 'undefined') {
    console.log('[Event Chronicle] Attempting fallback hook registration');
    // Some ST forks use a different hook pattern — we log and continue
  }
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

// Initialize on load
init().then(() => {
  registerHooks();
}).catch(err => {
  console.error('[Event Chronicle] Fatal initialization error:', err);
  showToast('error', '启动失败: ' + err.message);
});
