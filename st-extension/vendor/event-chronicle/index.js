"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// sdk/index.ts
var index_exports = {};
__export(index_exports, {
  PromptManager: () => PromptManager,
  appendEvents: () => appendEvents,
  applyInstructions: () => applyInstructions,
  complete: () => complete,
  exportMemory: () => exportMemory,
  exportMemoryFromEvents: () => exportMemoryFromEvents,
  exportRaw: () => exportRaw,
  exportRawFromEvents: () => exportRawFromEvents,
  extractEvents: () => extractEvents,
  getDataDir: () => getDataDir,
  initLLM: () => initLLM,
  loadChronicle: () => loadChronicle,
  loadEnv: () => loadEnv,
  loadMergeState: () => loadMergeState,
  mergeEvents: () => mergeEvents,
  processMessages: () => processMessages,
  resetMergeCounter: () => resetMergeCounter,
  saveChronicle: () => saveChronicle,
  setDataDir: () => setDataDir,
  startup: () => startup
});
module.exports = __toCommonJS(index_exports);

// config/index.ts
var import_dotenv = __toESM(require("dotenv"));
function loadEnv() {
  import_dotenv.default.config();
}
var config = {
  /** 全局默认 event_id，对应 env 中的 CHRONICLE_EVENT_ID，未配置时为 undefined */
  get defaultEventId() {
    return process.env.CHRONICLE_EVENT_ID || void 0;
  },
  /** 事件合并时取最近 N 条已有事件作为上下文窗口，默认 20 */
  get mergeWindowSize() {
    return process.env.CHRONICLE_MERGE_WINDOW ? parseInt(process.env.CHRONICLE_MERGE_WINDOW, 10) : 20;
  },
  /** 累计新增 N 条事件后自动触发合并，默认 5；设为 0 禁用自动合并 */
  get mergeTriggerThreshold() {
    return process.env.CHRONICLE_MERGE_TRIGGER ? parseInt(process.env.CHRONICLE_MERGE_TRIGGER, 10) : 5;
  },
  get llm() {
    return {
      get provider() {
        return process.env.LLM_PROVIDER || "openai";
      },
      get apiKey() {
        return process.env.LLM_API_KEY || "";
      },
      get baseUrl() {
        return process.env.LLM_BASE_URL || "https://api.openai.com/v1";
      },
      get model() {
        return process.env.LLM_MODEL || "gpt-4o";
      },
      get temperature() {
        return process.env.LLM_TEMPERATURE ? parseFloat(process.env.LLM_TEMPERATURE) : 0;
      },
      get maxTokens() {
        return process.env.LLM_MAX_TOKENS ? parseInt(process.env.LLM_MAX_TOKENS, 10) : 2048;
      },
      get timeout() {
        return process.env.LLM_TIMEOUT ? parseInt(process.env.LLM_TIMEOUT, 10) : 3e4;
      }
    };
  }
};

// core/llm/openai-client.ts
var import_openai = require("openai");
var OpenAIClient = class {
  client;
  config;
  constructor(config2) {
    this.config = config2;
    this.client = new import_openai.OpenAI({
      apiKey: config2.apiKey,
      baseURL: config2.baseUrl
    });
  }
  async complete(options) {
    const { messages } = options;
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      temperature: this.config.temperature ?? 0,
      // ChatMessage.role 已放宽为 string，调用方保证传入合法角色值
      messages
    });
    return response.choices[0].message.content ?? "";
  }
};

// core/llm/index.ts
var client;
function initLLM(config2) {
  client = new OpenAIClient(config2);
}
async function complete(options) {
  if (!client) {
    throw new Error(
      "LLM client is not initialized. Please call initLLM first."
    );
  }
  return client.complete(options);
}

// prompts/manager.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
function detectPromptsDir() {
  const prodCandidate = path.resolve(__dirname, "prompts");
  if (fs.existsSync(prodCandidate)) {
    const hasMd = fs.readdirSync(prodCandidate).some((f) => f.endsWith(".md"));
    if (hasMd) return prodCandidate;
  }
  return path.resolve(__dirname);
}
var PromptManager = class {
  // 内存缓存：promptName → 文件原始内容
  cache = /* @__PURE__ */ new Map();
  // 提示词 .md 文件所在目录的绝对路径
  promptsDir;
  constructor(promptsDir) {
    this.promptsDir = promptsDir ?? detectPromptsDir();
  }
  // ---------------------------------------------------------------------------
  // 公开 API
  // ---------------------------------------------------------------------------
  /**
   * 获取指定名称的提示词原始内容（含模板占位符）。
   *
   * 首次调用时从文件系统读取并写入缓存；后续调用直接从内存返回。
   *
   * @param name - 提示词文件名（不含 .md 扩展名），如 "extract-event"
   * @returns 提示词文件的完整文本内容
   * @throws 若对应 .md 文件不存在
   */
  get(name) {
    const cached = this.cache.get(name);
    if (cached !== void 0) {
      return cached;
    }
    const filePath = this.resolvePath(name);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Prompt file not found: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, "utf-8");
    this.cache.set(name, content);
    return content;
  }
  /**
   * 获取提示词并用给定变量替换其中的 `{{变量名}}` 占位符。
   *
   * 变量名匹配大小写敏感；未在 vars 中提供的占位符将保留原文不替换。
   *
   * @param name   - 提示词文件名（不含 .md 扩展名）
   * @param vars   - 键值对，键为占位符名（不含花括号），值为替换文本
   * @returns 替换后的提示词文本
   */
  getWithVars(name, vars) {
    let content = this.get(name);
    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\{\\{${escapeRegExp(key)}\\}\\}`, "g");
      content = content.replace(regex, value);
    }
    return content;
  }
  /**
   * 预加载 prompts/ 目录下所有 .md 文件到缓存。
   *
   * 适合在应用启动时调用，避免首次请求时的 I/O 延迟。
   *
   * @returns 已加载的提示词名称列表
   */
  preload() {
    const names = this.discoverNames();
    for (const name of names) {
      if (!this.cache.has(name)) {
        this.get(name);
      }
    }
    return names;
  }
  /**
   * 清除缓存。
   *
   * @param name - 可选，指定要清除的提示词名称；不传则清除全部缓存
   */
  clearCache(name) {
    if (name !== void 0) {
      this.cache.delete(name);
    } else {
      this.cache.clear();
    }
  }
  /**
   * 重新初始化：切换到新的提示词目录并清空缓存。
   *
   * 适用场景：
   *   - SDK 使用者通过 startup({ promptsDir }) 自定义提示词路径
   *   - 运行时动态切换提示词来源
   *
   * @param promptsDir - 新的提示词 .md 文件目录绝对路径
   */
  reinitialize(promptsDir) {
    this.promptsDir = path.resolve(promptsDir);
    this.cache.clear();
  }
  /**
   * 列出 prompts/ 目录下所有可用的提示词名称。
   *
   * @returns 提示词名称数组（即 .md 文件名去掉扩展名）
   */
  list() {
    return this.discoverNames();
  }
  /**
   * 判断指定名称的提示词文件是否存在。
   */
  has(name) {
    if (this.cache.has(name)) return true;
    return fs.existsSync(this.resolvePath(name));
  }
  // ---------------------------------------------------------------------------
  // 内部方法
  // ---------------------------------------------------------------------------
  /**
   * 将提示词名称解析为 .md 文件的绝对路径。
   */
  resolvePath(name) {
    return path.join(this.promptsDir, `${name}.md`);
  }
  /**
   * 扫描 prompts/ 目录，返回所有 .md 文件名（去掉扩展名）。
   */
  discoverNames() {
    if (!fs.existsSync(this.promptsDir)) {
      return [];
    }
    return fs.readdirSync(this.promptsDir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
  }
};
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
var promptManager = new PromptManager();
var manager_default = promptManager;

// core/store/runtimeContext.ts
var path2 = __toESM(require("path"));
var _dataDir = path2.resolve(process.cwd(), "data");
function getDataDir() {
  return _dataDir;
}
function setDataDir(dir) {
  _dataDir = path2.resolve(dir);
}

// core/logger/index.ts
var fs2 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var LEVEL_RANK = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};
var minLevel = process.env.LOG_LEVEL || "info";
var minRank = LEVEL_RANK[minLevel] ?? LEVEL_RANK.info;
var logToFile = process.env.LOG_TO_FILE !== "false";
var SENSITIVE_KEYS = ["apiKey", "apikey", "api_key", "LLM_API_KEY"];
function sanitize(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.includes(key) && typeof value === "string" && value.length > 8) {
      out[key] = value.slice(0, 8) + "***";
    } else {
      out[key] = value;
    }
  }
  return out;
}
function formatTime() {
  const now = /* @__PURE__ */ new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
function writeToFile(line) {
  if (!logToFile) return;
  try {
    const dir = path3.resolve(getDataDir(), "logs");
    if (!fs2.existsSync(dir)) {
      fs2.mkdirSync(dir, { recursive: true });
    }
    const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const filePath = path3.join(dir, `${date}.log`);
    fs2.appendFileSync(filePath, line + "\n", "utf-8");
  } catch {
  }
}
function output(level, module2, message, data) {
  if (LEVEL_RANK[level] < minRank) return;
  const time = formatTime();
  const dataStr = data ? " " + JSON.stringify(sanitize(data)) : "";
  const line = `[${time}] [${level.toUpperCase()}] [${module2}] ${message}${dataStr}`;
  const method = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  method(line);
  writeToFile(line);
}
var logger = {
  debug(module2, message, data) {
    output("debug", module2, message, data);
  },
  info(module2, message, data) {
    output("info", module2, message, data);
  },
  warn(module2, message, data) {
    output("warn", module2, message, data);
  },
  error(module2, message, data) {
    output("error", module2, message, data);
  }
};

// index.ts
async function startup(options = {}) {
  const { healthCheck = true } = options;
  logBanner();
  if (options.dataDir) {
    setDataDir(options.dataDir);
    logger.info("startup", "dataDir overridden", { dataDir: options.dataDir });
  }
  if (options.promptsDir) {
    manager_default.reinitialize(options.promptsDir);
    logger.info("startup", "promptsDir overridden", { promptsDir: options.promptsDir });
  }
  let llmConfig;
  if (options.llmConfig) {
    llmConfig = { ...options.llmConfig };
    logger.info("startup", "using explicit llmConfig", { provider: llmConfig.provider });
  } else {
    loadEnv();
    llmConfig = {
      provider: config.llm.provider,
      baseUrl: config.llm.baseUrl,
      apiKey: config.llm.apiKey,
      model: config.llm.model,
      temperature: config.llm.temperature,
      maxTokens: config.llm.maxTokens,
      timeout: config.llm.timeout
    };
  }
  if (!llmConfig.apiKey) {
    throw new Error(
      "\u7F3A\u5C11\u5FC5\u9700\u7684\u73AF\u5883\u53D8\u91CF: LLM_API_KEY\u3002\u8BF7\u5728 .env \u6587\u4EF6\u4E2D\u914D\u7F6E\uFF0C\u53C2\u8003 .env.example\u3002"
    );
  }
  log("\u2713", "\u914D\u7F6E\u52A0\u8F7D\u5B8C\u6210");
  logger.info("startup", "config loaded", { provider: llmConfig.provider, model: llmConfig.model });
  initLLM(llmConfig);
  log("\u2713", `LLM \u521D\u59CB\u5316\u5B8C\u6210 (provider: ${llmConfig.provider}, model: ${llmConfig.model})`);
  const names = manager_default.preload();
  if (names.length > 0) {
    log("\u2713", `\u63D0\u793A\u8BCD\u9884\u70ED\u5B8C\u6210 (${names.length} \u4E2A): ${names.join(", ")}`);
    logger.info("startup", "prompts preloaded", { count: names.length, names });
  } else {
    log("\u26A0", "\u672A\u53D1\u73B0\u4EFB\u4F55\u63D0\u793A\u8BCD .md \u6587\u4EF6");
  }
  if (healthCheck) {
    try {
      await pingLLM();
      log("\u2713", "LLM \u5065\u5EB7\u68C0\u67E5\u901A\u8FC7");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log("\u2717", `LLM \u5065\u5EB7\u68C0\u67E5\u5931\u8D25: ${message}`);
      logger.error("startup", "LLM health check failed", { error: message });
      throw new Error(
        `LLM \u8FDE\u901A\u6027\u9A8C\u8BC1\u5931\u8D25\u3002\u8BF7\u68C0\u67E5 .env \u4E2D\u7684 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL \u662F\u5426\u6B63\u786E\u3002
\u539F\u59CB\u9519\u8BEF: ${message}`
      );
    }
  } else {
    log("\u25CB", "\u5065\u5EB7\u68C0\u67E5\u5DF2\u8DF3\u8FC7");
  }
  logBannerEnd();
  return llmConfig;
}
async function pingLLM() {
  const response = await complete({
    messages: [{ role: "user", content: "ok" }]
  });
  if (!response || response.trim().length === 0) {
    throw new Error("LLM \u8FD4\u56DE\u4E86\u7A7A\u54CD\u5E94\uFF0C\u8BF7\u68C0\u67E5 API Key \u662F\u5426\u6709\u6548\u6216\u8D26\u6237\u4F59\u989D\u662F\u5426\u5145\u8DB3");
  }
}
var PREFIX = "[Event Chronicle]";
function log(mark, message) {
  console.log(`${PREFIX} ${mark.padEnd(2)} ${message}`);
}
function logBanner() {
  console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("\u2551          Event Chronicle \u542F\u52A8\u2026           \u2551");
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");
}
function logBannerEnd() {
  console.log(`${PREFIX} \u{1F680} \u542F\u52A8\u5B8C\u6210\uFF0C\u53EF\u4EE5\u5F00\u59CB\u63D0\u53D6\u4E8B\u4EF6
`);
}

// core/extractor/formatter.ts
function formatMessages(messages) {
  return messages.map((msg) => `${msg.role}:
${msg.content}`).join("\n\n");
}

// core/extractor/parser.ts
function parseEvents(response) {
  const trimmed = response.trim();
  const codeBlock = extractCodeBlock(trimmed);
  const json = codeBlock ?? trimmed;
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      `Failed to parse extractor response as JSON. Raw (first 200 chars): ${trimmed.slice(0, 200)}`
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error(
      `Extractor response must be a JSON array, got ${typeof parsed}`
    );
  }
  return parsed;
}
function extractCodeBlock(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

// core/extractor/index.ts
async function extractEvents(messages, existingEvents) {
  const formattedMessages = formatMessages(messages);
  const prompt = manager_default.getWithVars("extract-event", {
    existingEvents: existingEvents ?? "",
    recentMessages: formattedMessages
  });
  const response = await complete({
    messages: [{ role: "user", content: prompt }]
  });
  const events = parseEvents(response);
  return injectIds(events);
}
function injectIds(events) {
  const ts = Date.now();
  for (const e of events) {
    e.id = `evt_${ts}_${Math.random().toString(16).slice(2, 8)}`;
  }
  return events;
}

// core/store/loadChronicle.ts
var fs3 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
function loadChronicle(existingEventId) {
  if (!existingEventId) {
    return [];
  }
  const dataDir = getDataDir();
  const filePath = path4.join(dataDir, `${existingEventId}.json`);
  if (!fs3.existsSync(filePath)) {
    return [];
  }
  let raw;
  try {
    raw = fs3.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed;
}

// core/store/saveChronicle.ts
var fs4 = __toESM(require("fs"));
var path5 = __toESM(require("path"));
function saveChronicle(events) {
  const dataDir = getDataDir();
  ensureDir(dataDir);
  const filename = `event_${Date.now()}.json`;
  const filePath = path5.join(dataDir, filename);
  fs4.writeFileSync(filePath, JSON.stringify(events, null, 2), "utf-8");
  return filename;
}
function ensureDir(dir) {
  if (!fs4.existsSync(dir)) {
    fs4.mkdirSync(dir, { recursive: true });
  }
}

// core/store/appendEvents.ts
var fs5 = __toESM(require("fs"));
var path6 = __toESM(require("path"));
function appendEvents(newEvents, eventId) {
  const dataDir = getDataDir();
  ensureDir(dataDir);
  const resolvedId = eventId ?? config.defaultEventId;
  if (resolvedId) {
    const filename2 = `${resolvedId}.json`;
    const filePath2 = path6.join(dataDir, filename2);
    if (fs5.existsSync(filePath2)) {
      const raw = fs5.readFileSync(filePath2, "utf-8");
      let existing = [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          existing = parsed;
        }
      } catch {
      }
      const merged = [...existing, ...newEvents];
      fs5.writeFileSync(filePath2, JSON.stringify(merged, null, 2), "utf-8");
    } else {
      fs5.writeFileSync(filePath2, JSON.stringify(newEvents, null, 2), "utf-8");
    }
    return filename2;
  }
  const filename = `event_${Date.now()}.json`;
  const filePath = path6.join(dataDir, filename);
  fs5.writeFileSync(filePath, JSON.stringify(newEvents, null, 2), "utf-8");
  return filename;
}

// core/store/mergeState.ts
var fs6 = __toESM(require("fs"));
var path7 = __toESM(require("path"));
function loadMergeState(eventId) {
  const filePath = stateFilePath(eventId);
  if (!fs6.existsSync(filePath)) {
    return { newEventCount: 0, lastMergeAt: null };
  }
  try {
    const raw = fs6.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { newEventCount: 0, lastMergeAt: null };
  }
}
function saveMergeState(eventId, state) {
  const filePath = stateFilePath(eventId);
  ensureDir(path7.dirname(filePath));
  fs6.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
}
function recordNewEvents(eventId, count) {
  const state = loadMergeState(eventId);
  state.newEventCount += count;
  saveMergeState(eventId, state);
  return state;
}
function resetMergeCounter(eventId) {
  const state = {
    newEventCount: 0,
    lastMergeAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  saveMergeState(eventId, state);
  return state;
}
function stateFilePath(eventId) {
  return path7.join(getDataDir(), `${eventId}_state.json`);
}

// core/merge/formatter.ts
function formatEvents(events) {
  return JSON.stringify(events, null, 2);
}
function applyWindow(events, windowSize) {
  if (events.length <= windowSize) return events;
  return events.slice(events.length - windowSize);
}

// core/merge/parser.ts
function parseInstructions(response) {
  const trimmed = response.trim();
  const codeBlock = extractCodeBlock2(trimmed);
  const json = codeBlock ?? trimmed;
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      `Failed to parse merge response as JSON. Raw (first 200 chars): ${trimmed.slice(0, 200)}`
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error(
      `Merge response must be a JSON array, got ${typeof parsed}`
    );
  }
  return parsed.filter((item) => {
    if (typeof item !== "object" || item === null) {
      logger.warn("merge", "Skipping non-object instruction", { item });
      return false;
    }
    const inst = item;
    const action = inst.action;
    if (action !== "update" && action !== "delete" && action !== "add" && action !== "keep") {
      logger.warn("merge", "Unknown action, skipping", { action: String(action) });
      return false;
    }
    if ((action === "update" || action === "delete") && typeof inst.id !== "string") {
      logger.warn("merge", `${action} instruction missing valid id, skipping`);
      return false;
    }
    if (action === "update" && (typeof inst.changes !== "object" || inst.changes === null)) {
      logger.warn("merge", "update instruction missing changes object, skipping");
      return false;
    }
    if (action === "add" && (typeof inst.event !== "object" || inst.event === null)) {
      logger.warn("merge", "add instruction missing event object, skipping");
      return false;
    }
    return true;
  });
}
function extractCodeBlock2(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

// core/merge/index.ts
async function mergeEvents(existingEvents, newEvents) {
  const windowSize = config.mergeWindowSize;
  const windowedExisting = applyWindow(existingEvents, windowSize);
  const existingJson = formatEvents(windowedExisting);
  const newEventsJson = formatEvents(newEvents);
  const prompt = manager_default.getWithVars("merge-event", {
    existingEvents: existingJson,
    newEvents: newEventsJson
  });
  const response = await complete({
    messages: [{ role: "user", content: prompt }]
  });
  const instructions = parseInstructions(response);
  return applyInstructions(existingEvents, newEvents, instructions);
}
function applyInstructions(existingEvents, _newEvents, instructions) {
  const map = /* @__PURE__ */ new Map();
  for (const event of existingEvents) {
    if (!event.id) {
      logger.warn("merge", "Existing event missing id, generating fallback", { title: event.title });
      event.id = generateFallbackId();
    }
    map.set(event.id, { ...event });
  }
  for (const inst of instructions) {
    switch (inst.action) {
      case "update": {
        if (!inst.id) break;
        const target = map.get(inst.id);
        if (!target) {
          logger.warn("merge", "update target not found", { id: inst.id });
          break;
        }
        if (inst.changes) {
          const { id: _, ...safeChanges } = inst.changes;
          Object.assign(target, safeChanges);
        }
        break;
      }
      case "delete": {
        if (!inst.id) break;
        if (!map.has(inst.id)) {
          logger.warn("merge", "delete target not found", { id: inst.id });
          break;
        }
        map.delete(inst.id);
        break;
      }
      case "add": {
        if (!inst.event) break;
        const event = { ...inst.event };
        if (!event.id) {
          logger.warn("merge", "add instruction event missing id, generating fallback");
          event.id = generateFallbackId();
        }
        if (map.has(event.id)) {
          logger.warn("merge", "Duplicate add, skipping", { id: event.id });
          break;
        }
        map.set(event.id, event);
        break;
      }
      case "keep":
        break;
    }
  }
  return Array.from(map.values());
}
function generateFallbackId() {
  const ts = Date.now();
  const rand = Math.random().toString(16).slice(2, 8);
  return `evt_${ts}_${rand}`;
}

// core/index.ts
async function processMessages(messages, options = {}) {
  const autoMerge = options.autoMerge ?? true;
  const resolvedExistingId = options.existingEventId ?? config.defaultEventId;
  const existingEvents = loadChronicle(resolvedExistingId);
  const extractStart = Date.now();
  const events = await extractEvents(
    messages,
    JSON.stringify(existingEvents)
  );
  if (events.length > 0) {
    logger.info("extract", "events extracted", {
      count: events.length,
      durationMs: Date.now() - extractStart
    });
  }
  const resolvedEventId = options.eventId ?? config.defaultEventId;
  let merged = false;
  let mergedFile;
  let mergedEvents;
  if (autoMerge && resolvedEventId && events.length > 0) {
    const threshold = config.mergeTriggerThreshold;
    if (threshold > 0) {
      const state = recordNewEvents(resolvedEventId, events.length);
      if (state.newEventCount >= threshold) {
        logger.info("core", "merge triggered", {
          counter: state.newEventCount,
          threshold,
          eventId: resolvedEventId
        });
        const fullExisting = loadChronicle(resolvedEventId);
        const mergeStart = Date.now();
        mergedEvents = await mergeEvents(fullExisting, events);
        mergedFile = saveChronicle(mergedEvents);
        resetMergeCounter(resolvedEventId);
        merged = true;
        logger.info("core", "merge completed", {
          before: fullExisting.length,
          after: mergedEvents.length,
          durationMs: Date.now() - mergeStart,
          mergedFile
        });
      }
    }
  }
  const storedFile = appendEvents(events, resolvedEventId);
  logger.info("store", "events stored", {
    file: storedFile,
    count: events.length
  });
  return { events, storedFile, merged, mergedFile, mergedEvents };
}

// core/exporter/raw-exporter.ts
function exportRaw(eventId) {
  const events = loadChronicle(eventId);
  return exportRawFromEvents(events);
}
function exportRawFromEvents(events) {
  return JSON.stringify(events, null, 2);
}

// core/exporter/memory-exporter.ts
function exportMemory(fileName, options) {
  const events = loadChronicle(fileName);
  return exportMemoryFromEvents(events, options);
}
function exportMemoryFromEvents(events, options) {
  const markdown = renderMemoryMarkdown(events, options);
  return manager_default.getWithVars("memory-prompt", {
    memoryTimeline: markdown
  });
}
function renderMemoryMarkdown(events, options) {
  const title = options?.title ?? "Event Chronicle Memory";
  const threshold = options?.highlightThreshold ?? 7;
  const includeTimeline = options?.includeTimeline ?? true;
  const groupBy = options?.groupBy ?? "location";
  if (events.length === 0) {
    return `# ${title}

_No events recorded yet._`;
  }
  const importanceMin = Math.min(...events.map((e) => e.importance));
  const importanceMax = Math.max(...events.map((e) => e.importance));
  const lines = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push(
    `${events.length} events \xB7 importance range ${importanceMin}\u2013${importanceMax}`
  );
  lines.push("");
  if (groupBy !== "none") {
    const groups = groupEvents(events, groupBy);
    lines.push(`## By ${groupBy === "location" ? "Location" : "Tag"}`);
    lines.push("");
    for (const [name, group] of groups) {
      lines.push(`### ${name || "Unspecified"} (${group.length} events)`);
      lines.push("");
      for (const e of group) {
        lines.push(
          `- **${e.title}** (\u2605${e.importance}): ${e.summary} \u2014 _${e.participants.join(", ") || "none"}_` + (e.location ? ` @ ${e.location}` : "")
        );
      }
      lines.push("");
    }
  }
  const keyEvents = events.filter((e) => e.importance >= threshold);
  if (keyEvents.length > 0) {
    lines.push(`## Key Events (importance \u2265 ${threshold})`);
    lines.push("");
    for (const e of keyEvents) {
      lines.push(`### ${e.title} (\u2605${e.importance})`);
      lines.push(e.summary);
      lines.push("");
      const meta = [];
      if (e.participants.length > 0)
        meta.push(`Participants: ${e.participants.join(", ")}`);
      if (e.location) meta.push(`Location: ${e.location}`);
      if (e.tags.length > 0) meta.push(`Tags: ${e.tags.join(", ")}`);
      if (meta.length > 0) {
        lines.push(meta.join(" | "));
        lines.push("");
      }
    }
  }
  if (includeTimeline) {
    lines.push("## Timeline");
    lines.push("");
    lines.push("| # | Event | \u2605 | Participants | Location |");
    lines.push("|---|-------|---|-------------|----------|");
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      lines.push(
        `| ${i + 1} | ${e.title} | ${e.importance} | ${e.participants.join(", ") || "\u2014"} | ${e.location || "\u2014"} |`
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
function groupEvents(events, by) {
  const map = /* @__PURE__ */ new Map();
  for (const e of events) {
    const keys = by === "location" ? [e.location || ""] : e.tags.length > 0 ? [e.tags[0]] : [""];
    for (const key of keys) {
      const existing = map.get(key);
      if (existing) {
        existing.push(e);
      } else {
        map.set(key, [e]);
      }
    }
  }
  return map;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PromptManager,
  appendEvents,
  applyInstructions,
  complete,
  exportMemory,
  exportMemoryFromEvents,
  exportRaw,
  exportRawFromEvents,
  extractEvents,
  getDataDir,
  initLLM,
  loadChronicle,
  loadEnv,
  loadMergeState,
  mergeEvents,
  processMessages,
  resetMergeCounter,
  saveChronicle,
  setDataDir,
  startup
});
//# sourceMappingURL=index.js.map