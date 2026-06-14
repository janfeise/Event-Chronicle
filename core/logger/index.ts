/**
 * 轻量日志模块 — console + 文件双输出。
 *
 * 使用：
 *   import { logger } from "./core/logger";
 *   logger.info("extract", "events extracted", { count: 3, durationMs: 1200 });
 *
 * 配置（.env）：
 *   LOG_LEVEL=info    # debug | info | warn | error
 *   LOG_TO_FILE=true  # 是否持久化到 data/logs/
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

const minLevel = (process.env.LOG_LEVEL || "info") as Level;
const minRank = LEVEL_RANK[minLevel] ?? LEVEL_RANK.info;
const logToFile = process.env.LOG_TO_FILE !== "false";

// ---------------------------------------------------------------------------
// 脱敏
// ---------------------------------------------------------------------------

const SENSITIVE_KEYS = ["apiKey", "apikey", "api_key", "LLM_API_KEY"];

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (
      SENSITIVE_KEYS.includes(key) &&
      typeof value === "string" &&
      value.length > 8
    ) {
      out[key] = value.slice(0, 8) + "***";
    } else {
      out[key] = value;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------

function formatTime(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function writeToFile(line: string): void {
  if (!logToFile) return;

  try {
    const dir = path.resolve(process.cwd(), "data", "logs");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filePath = path.join(dir, `${date}.log`);
    fs.appendFileSync(filePath, line + "\n", "utf-8");
  } catch {
    // 静默降级：磁盘满等异常不阻塞主流程
  }
}

function output(
  level: Level,
  module: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (LEVEL_RANK[level] < minRank) return;

  const time = formatTime();
  const dataStr = data ? " " + JSON.stringify(sanitize(data)) : "";
  const line = `[${time}] [${level.toUpperCase()}] [${module}] ${message}${dataStr}`;

  // console
  const method =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;
  method(line);

  // file
  writeToFile(line);
}

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

export const logger = {
  debug(module: string, message: string, data?: Record<string, unknown>) {
    output("debug", module, message, data);
  },
  info(module: string, message: string, data?: Record<string, unknown>) {
    output("info", module, message, data);
  },
  warn(module: string, message: string, data?: Record<string, unknown>) {
    output("warn", module, message, data);
  },
  error(module: string, message: string, data?: Record<string, unknown>) {
    output("error", module, message, data);
  },
};

export default logger;
