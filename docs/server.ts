// ============================================================================
// Event Chronicle Web Demo — 本地后端
//
// 启动：
//   cp demo-web/.env.example demo-web/.env   # 填入 API Key
//   cd demo-web && npm install
//   npm run dev
//
// API：
//   GET  /api/status         — 健康检查
//   POST /api/process        — 发送对话 + 提取事件
//   GET  /api/export/memory  — Memory Export
//   GET  /api/export/raw     — Raw JSON Export
// ============================================================================

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

// ---------- Event Chronicle SDK ----------
import {
  startup,
  initLLM,
  complete,
  extractEvents,
  appendEvents,
  loadChronicle,
  exportMemory,
  exportRaw,
} from "event-chronicle";
import type { Event, ChatMessage } from "event-chronicle";

// ===========================================================================
// 配置
// ===========================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 优先加载 demo-web/.env，降级到项目根 .env
dotenv.config({ path: path.resolve(__dirname, ".env") });
if (!process.env.LLM_API_KEY) {
  dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
}

const PORT = 3456;
const EVENT_ID = "demo-chronicle";

// ===========================================================================
// 初始化
// ===========================================================================

let sdkReady = false;
let llmProvider = "";
let llmModel = "";

async function initSDK(apiKey?: string): Promise<void> {
  const key = apiKey || process.env.LLM_API_KEY;
  if (!key) {
    sdkReady = false;
    return;
  }

  const llmConfig = {
    provider: process.env.LLM_PROVIDER || "openai",
    baseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
    apiKey: key,
    model: process.env.LLM_MODEL || "gpt-4o",
  };

  initLLM(llmConfig);
  llmProvider = llmConfig.provider;
  llmModel = llmConfig.model;
  sdkReady = true;
}

// 启动时尝试初始化
if (process.env.LLM_API_KEY) {
  try {
    initLLM({
      provider: process.env.LLM_PROVIDER || "openai",
      baseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
      apiKey: process.env.LLM_API_KEY,
      model: process.env.LLM_MODEL || "gpt-4o",
    });
    sdkReady = true;
    llmProvider = process.env.LLM_PROVIDER || "openai";
    llmModel = process.env.LLM_MODEL || "gpt-4o";
  } catch {
    sdkReady = false;
  }
}

// ===========================================================================
// 标签映射：SDK tags[] → 中文分类
// ===========================================================================

const TAG_MAP: [string[], string][] = [
  [["pet", "animal", "cat", "dog", "宠物", "猫", "狗"], "宠物"],
  [["health", "medical", "体检", "健康", "医院", "vet"], "健康"],
  [["emotion", "feeling", "mood", "情感", "情绪", "心情"], "情感"],
  [["advice", "suggestion", "建议", "推荐", "营养", "饮食"], "建议"],
  [["daily", "routine", "日常", "生活"], "日常"],
];

function mapTag(sdkTags: string[]): string {
  for (const tag of sdkTags) {
    const lower = tag.toLowerCase();
    for (const [keywords, category] of TAG_MAP) {
      if (keywords.some((kw) => lower.includes(kw))) {
        return category;
      }
    }
  }
  return "其他";
}

function makeTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

// ===========================================================================
// Express
// ===========================================================================

const app = express();
app.use(cors());
app.use(express.json());

// ---- 静态文件（前端） ----
app.use(express.static(__dirname));

// ---- GET /api/status ----
app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    configured: sdkReady,
    provider: llmProvider,
    model: llmModel,
  });
});

// ---- POST /api/process ----
app.post("/api/process", async (req, res) => {
  try {
    const { messages, apiKey, baseUrl, model } = req.body as {
      messages?: { role: string; content: string; time?: string }[];
      apiKey?: string;
      baseUrl?: string;
      model?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }

    // 如果前端传了配置，重新初始化 LLM
    if (apiKey) {
      const llmConfig: {
        provider: string;
        baseUrl: string;
        apiKey: string;
        model: string;
      } = {
        provider: "openai",
        baseUrl: baseUrl || process.env.LLM_BASE_URL || "https://api.openai.com/v1",
        apiKey: apiKey,
        model: model || process.env.LLM_MODEL || "gpt-4o",
      };
      initLLM(llmConfig);
      llmProvider = llmConfig.provider;
      llmModel = llmConfig.model;
      sdkReady = true;
    }

    if (!sdkReady) {
      return res.status(503).json({
        error: "LLM not configured",
        message: "请在 demo-web/.env 中配置 LLM_API_KEY，或在页面设置中填入 API Key",
      });
    }

    // 1. 生成 AI 回复
    const history = messages
      .map((m) => {
        const label = m.role === "user" ? "用户" : "助手";
        return `${label}: ${m.content}`;
      })
      .join("\n");

    const replyPrompt = `你是一位温暖、有同理心的 AI 助手。请基于以下对话记录，生成一段自然的对话回复（中文）。

对话记录：
${history}

请直接回复一段自然的对话文本，不要包含任何标记或格式。`;

    const replyText = await complete({
      messages: [{ role: "user", content: replyPrompt }],
    });

    // 2. 提取事件
    const chatMessages: ChatMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const events = await extractEvents(chatMessages);
    if (events.length > 0) {
      console.log("[Server] 提取事件:", events.length, "条",
        events.map((e: Event) => e.title));
    }

    // 3. 持久化
    if (events.length > 0) {
      appendEvents(events, EVENT_ID);
    }

    // 4. 转换为前端格式
    const timelineEvents = events.map((e: Event) => ({
      id: e.id,
      title: e.title,
      description: e.summary,
      tag: mapTag(e.tags || []),
      time: makeTime(),
    }));

    res.json({
      reply: replyText.trim(),
      events: timelineEvents,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/process] Error:", message);
    res.status(500).json({ error: "处理失败", message });
  }
});

// ---- GET /api/events ----
app.get("/api/events", (_req, res) => {
  try {
    const events = loadChronicle(EVENT_ID);
    res.json({ events });
  } catch {
    res.json({ events: [] });
  }
});

// ---- 消息持久化 ----
import * as fs from "fs";

const MSG_FILE = path.resolve(__dirname, "..", "data", "demo-messages.json");

function loadMessagesFile(): unknown[] {
  try {
    if (fs.existsSync(MSG_FILE)) {
      return JSON.parse(fs.readFileSync(MSG_FILE, "utf-8"));
    }
  } catch { /* ignore */ }
  return [];
}

function saveMessagesFile(messages: unknown[]): void {
  const dir = path.dirname(MSG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MSG_FILE, JSON.stringify(messages, null, 2), "utf-8");
}

app.get("/api/messages", (_req, res) => {
  res.json({ messages: loadMessagesFile() });
});

app.post("/api/messages", (req, res) => {
  try {
    const { messages } = req.body as { messages?: unknown[] };
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array is required" });
    }
    saveMessagesFile(messages);
    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "保存失败", message });
  }
});

// ---- GET /api/export/memory ----
app.get("/api/export/memory", (_req, res) => {
  try {
    const memory = exportMemory(EVENT_ID);
    res.json({ memory });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "导出失败", message });
  }
});

// ---- GET /api/export/raw ----
app.get("/api/export/raw", (_req, res) => {
  try {
    const raw = exportRaw(EVENT_ID);
    res.json({ events: JSON.parse(raw) });
  } catch {
    res.json({ events: [] });
  }
});

// ===========================================================================
// 启动
// ===========================================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`╔══════════════════════════════════════════╗`);
  console.log(`║   Event Chronicle Web Demo  后端已启动    ║`);
  console.log(`║   地址: http://localhost:${PORT}            ║`);
  console.log(`║   SDK 状态: ${sdkReady ? "✅ 已配置" : "⚠ 未配置 API Key"}${" ".repeat(16 - (sdkReady ? 6 : 10))}║`);
  console.log(`╚══════════════════════════════════════════╝`);
});
