// index.js — Event Chronicle SillyTavern Extension (Browser ES Module)
// =============================================================================
// Loaded by ST as <script type="module">. No Node.js APIs — pure browser code.
// =============================================================================

import * as ecBridge from './lib/ec-bridge.js';

console.log('═══════════════════════════════════════════');
console.log('[Event Chronicle] index.js 已加载（浏览器 ES Module）');
console.log('═══════════════════════════════════════════');

// ---------------------------------------------------------------------------
// Default settings
// ---------------------------------------------------------------------------

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
// Internal state
// ---------------------------------------------------------------------------

let sdkReady = false;
let messageCount = 0;
let currentSettings = { ...DEFAULT_SETTINGS };

// ---------------------------------------------------------------------------
// Settings (ST provides extension_settings globally)
// ---------------------------------------------------------------------------

function loadSettings() {
  try {
    if (typeof extension_settings !== 'undefined' && extension_settings['event-chronicle']) {
      return extension_settings['event-chronicle'];
    }
  } catch (e) { /* not in ST */ }
  return null;
}

function getMergedSettings() {
  const saved = loadSettings() || {};
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    llmOverride: { ...DEFAULT_SETTINGS.llmOverride, ...((saved || {}).llmOverride || {}) },
  };
}

// ---------------------------------------------------------------------------
// LLM Config: read from extension settings, fall back to ST globals
// ---------------------------------------------------------------------------

function buildLLMConfig() {
  const override = currentSettings.llmOverride || {};

  let stProvider = 'openai';
  let stBaseUrl = 'https://api.openai.com/v1';
  let stApiKey = '';
  let stModel = 'gpt-4o-mini';

  // Try to read from ST globals
  try {
    if (typeof oai_settings !== 'undefined') {
      stBaseUrl = oai_settings.reverse_proxy || stBaseUrl;
      stModel = oai_settings.model || stModel;
    }
    if (typeof main_api !== 'undefined') stProvider = main_api || stProvider;
    if (typeof SECRET_KEYS !== 'undefined' && SECRET_KEYS.OPENAI) stApiKey = SECRET_KEYS.OPENAI;
  } catch (e) { /* not in ST */ }

  if (!stApiKey && typeof process !== 'undefined' && process.env) {
    stApiKey = process.env.OPENAI_API_KEY || '';
  }

  return {
    provider: override.provider || stProvider,
    baseUrl: override.baseUrl || stBaseUrl,
    apiKey: override.apiKey || stApiKey,
    model: override.model || stModel,
    temperature: (override.temperature !== undefined && override.temperature !== null && override.temperature !== '')
      ? Number(override.temperature) : 0,
    maxTokens: override.maxTokens || currentSettings.overrideMaxTokens || 2048,
  };
}

// ---------------------------------------------------------------------------
// Chat helpers (ST provides getContext())
// ---------------------------------------------------------------------------

function getCurrentChatId() {
  try {
    if (typeof getContext === 'function') {
      const ctx = getContext();
      if (ctx && ctx.chatId) return String(ctx.chatId);
      if (ctx && ctx.name2) return String(ctx.name2);
    }
  } catch (e) { /* ignore */ }
  return 'default';
}

function getRecentChatMessages() {
  try {
    if (typeof getContext === 'function') {
      const ctx = getContext();
      if (ctx && Array.isArray(ctx.chat)) {
        return ctx.chat;
      }
    }
  } catch (e) { /* ignore */ }
  return [];
}

// ---------------------------------------------------------------------------
// Toast notification
// ---------------------------------------------------------------------------

function showToast(type, message) {
  try {
    if (typeof toastr !== 'undefined') {
      toastr[type]('[Event Chronicle] ' + message);
    }
  } catch (e) {
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
  // 1. Load settings
  currentSettings = getMergedSettings();

  // 2. Build LLM config
  const llmConfig = buildLLMConfig();

  if (!llmConfig.apiKey) {
    console.warn('[Event Chronicle] 未配置 API Key，扩展进入待机状态。');
    showToast('warning', '未配置 API 密钥。请在扩展设置中配置。');
    sdkReady = false;
    return;
  }

  // 3. Initialize bridge with LLM config
  try {
    ecBridge.setLLMConfig(llmConfig);
    sdkReady = true;
    console.log('[Event Chronicle] 初始化完成');
    console.log('[Event Chronicle] Provider: ' + llmConfig.provider + ', Model: ' + llmConfig.model);
  } catch (err) {
    console.error('[Event Chronicle] 初始化失败:', err.message);
    sdkReady = false;
    showToast('error', '初始化失败: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// Event extraction trigger
// ---------------------------------------------------------------------------

function onChatChanged() {
  if (!sdkReady) return;

  messageCount++;
  const threshold = currentSettings.extractTriggerCount || 10;

  if (messageCount >= threshold) {
    triggerExtraction();
    messageCount = 0;
  }
}

async function triggerExtraction() {
  const chatId = getCurrentChatId();
  const messages = getRecentChatMessages();
  if (!messages || messages.length === 0) return;

  try {
    const recent = messages.slice(-(currentSettings.extractTriggerCount * 2));
    const result = await ecBridge.processMessages(recent, {
      eventId: chatId,
      autoMerge: true,
      mergeThreshold: currentSettings.mergeTriggerCount || 5,
    });

    if (result.events.length > 0) {
      console.log('[Event Chronicle] 提取 ' + result.events.length + ' 个事件 (chat: ' + chatId + ')');
    }
    if (result.merged) {
      console.log('[Event Chronicle] 自动合并触发，共 ' + (result.mergedEvents ? result.mergedEvents.length : 0) + ' 个事件');
    }
  } catch (err) {
    console.error('[Event Chronicle] 提取失败:', err.message);
    showToast('error', '事件提取失败: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// Memory injection (generate_interceptor)
// ---------------------------------------------------------------------------

function buildMemoryPrompt() {
  if (!sdkReady) return '';
  try {
    const chatId = getCurrentChatId();
    return ecBridge.getMemory(chatId, { highlightThreshold: 6 });
  } catch (e) {
    return '';
  }
}

/**
 * Global generate interceptor — ST calls this before each text generation.
 * Registered via manifest.json: "generate_interceptor": "ecGenerateInterceptor"
 */
function ecGenerateInterceptor(data) {
  try {
    const memory = buildMemoryPrompt();
    if (!memory || !memory.trim()) return;

    if (data && Array.isArray(data.messages)) {
      const existingIdx = data.messages.findIndex(
        m => m.role === 'system' && m.content && m.content.includes('Event Chronicle Memory')
      );
      if (existingIdx >= 0) {
        data.messages[existingIdx].content = memory;
      } else {
        data.messages.unshift({ role: 'system', content: memory });
      }
    }
  } catch (err) {
    console.error('[Event Chronicle] 记忆注入失败:', err.message);
  }
}

// Expose globally (ST looks for this function by name)
globalThis.ecGenerateInterceptor = ecGenerateInterceptor;
if (typeof window !== 'undefined') window.ecGenerateInterceptor = ecGenerateInterceptor;

// ---------------------------------------------------------------------------
// Public API (exposed to settings panel & timeline browser)
// ---------------------------------------------------------------------------

const EventChronicleAPI = {
  isReady: () => sdkReady,
  getSettings: () => currentSettings,

  getEvents: (chatId) => ecBridge.getEvents(chatId || getCurrentChatId()),
  getAllEvents: () => ecBridge.getAllEvents(),
  updateEvent: (chatId, event) => ecBridge.updateEvent(chatId, event),
  deleteEvent: (chatId, eventId) => ecBridge.deleteEvent(chatId, eventId),

  exportMemory: (chatId, opts) => ecBridge.getMemory(chatId || getCurrentChatId(), opts),

  startBatchGeneration: (options) => {
    options = options || {};
    return ecBridge.startBatchGeneration({
      ...options,
      chatId: options.chatId || getCurrentChatId(),
    });
  },
  getBatchProgress: (chatId) => ecBridge.getBatchProgress(chatId || getCurrentChatId()),

  getCurrentChatId,
  triggerExtraction,

  onSettingsChanged() {
    const newSettings = getMergedSettings();

    const oldLLM = currentSettings.llmOverride || {};
    const newLLM = newSettings.llmOverride || {};
    const llmChanged =
      oldLLM.provider !== newLLM.provider ||
      oldLLM.model !== newLLM.model ||
      oldLLM.apiKey !== newLLM.apiKey ||
      oldLLM.baseUrl !== newLLM.baseUrl ||
      currentSettings.overrideMaxTokens !== newSettings.overrideMaxTokens;

    currentSettings = newSettings;

    if (llmChanged) {
      const llmConfig = buildLLMConfig();
      ecBridge.setLLMConfig(llmConfig);
      sdkReady = !!llmConfig.apiKey;
      console.log('[Event Chronicle] LLM 配置已更新');
      showToast('success', 'LLM 配置已更新');
    }

    messageCount = 0;
  },
};

// Expose globally
globalThis.EventChronicle = EventChronicleAPI;
if (typeof window !== 'undefined') window.EventChronicle = EventChronicleAPI;

// ---------------------------------------------------------------------------
// Hook registration (ST event system)
// ---------------------------------------------------------------------------

function registerHooks() {
  const hasEventSource = typeof eventSource !== 'undefined' && typeof eventSource.on === 'function';
  const hasEventTypes = typeof event_types !== 'undefined';

  if (hasEventSource && hasEventTypes) {
    if (event_types.CHAT_CHANGED) {
      eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    }
    console.log('[Event Chronicle] 事件钩子已注册');
  } else {
    console.log('[Event Chronicle] ST 事件系统未就绪，延迟注册');
    // Retry after a short delay
    setTimeout(registerHooks, 2000);
  }
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

try {
  init().then(() => {
    registerHooks();
    console.log('[Event Chronicle] ✅ 扩展就绪');
  }).catch(err => {
    console.error('═══════════════════════════════════════════');
    console.error('[Event Chronicle] 致命错误:');
    console.error('[Event Chronicle]', err.message);
    console.error('[Event Chronicle]', err.stack);
    console.error('═══════════════════════════════════════════');
    showToast('error', '启动失败: ' + err.message);
  });
} catch (err) {
  console.error('═══════════════════════════════════════════');
  console.error('[Event Chronicle] 同步加载错误:');
  console.error('[Event Chronicle]', err.message);
  console.error('[Event Chronicle]', err.stack);
  console.error('═══════════════════════════════════════════');
}

export { ecGenerateInterceptor, EventChronicleAPI, init, onChatChanged };
