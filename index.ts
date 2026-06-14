// =============================================================================
// Event Chronicle — 统一启动入口
//
// 启动流程：
//   1. 消费 config 配置（env 读取由 config/index.ts 完成）
//   2. 初始化 LLM 客户端
//   3. 预热提示词缓存
//   4. 健康检查（可选，默认开启）
// =============================================================================

import { config } from "./config";
import { initLLM, complete } from "./core/llm";
import promptManager from "./prompts/manager";
import { logger } from "./core/logger";
import type { LLMConfig } from "./types";

// ---------------------------------------------------------------------------
// 启动选项
// ---------------------------------------------------------------------------

export interface StartupOptions {
  /** 是否执行 LLM 健康检查，默认 true */
  healthCheck?: boolean;
}

// ---------------------------------------------------------------------------
// 主启动函数
// ---------------------------------------------------------------------------

export async function startup(options: StartupOptions = {}): Promise<LLMConfig> {
  const { healthCheck = true } = options;

  logBanner();

  // ---- 1. 加载配置 ----
  const llmConfig: LLMConfig = {
    provider: config.llm.provider,
    baseUrl: config.llm.baseUrl,
    apiKey: config.llm.apiKey,
    model: config.llm.model,
    temperature: config.llm.temperature,
    maxTokens: config.llm.maxTokens,
    timeout: config.llm.timeout,
  };

  if (!llmConfig.apiKey) {
    throw new Error(
      "缺少必需的环境变量: LLM_API_KEY。请在 .env 文件中配置，参考 .env.example。",
    );
  }

  log("✓", "配置加载完成");
  logger.info("startup", "config loaded", { provider: llmConfig.provider, model: llmConfig.model });

  // ---- 2. 初始化 LLM 客户端 ----
  initLLM(llmConfig);
  log("✓", `LLM 初始化完成 (provider: ${llmConfig.provider}, model: ${llmConfig.model})`);

  // ---- 3. 预热提示词缓存 ----
  const names = promptManager.preload();
  if (names.length > 0) {
    log("✓", `提示词预热完成 (${names.length} 个): ${names.join(", ")}`);
    logger.info("startup", "prompts preloaded", { count: names.length, names });
  } else {
    log("⚠", "未发现任何提示词 .md 文件");
  }

  // ---- 4. 健康检查 ----
  if (healthCheck) {
    try {
      await pingLLM();
      log("✓", "LLM 健康检查通过");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log("✗", `LLM 健康检查失败: ${message}`);
      logger.error("startup", "LLM health check failed", { error: message });
      throw new Error(
        `LLM 连通性验证失败。请检查 .env 中的 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL 是否正确。\n` +
          `原始错误: ${message}`,
      );
    }
  } else {
    log("○", "健康检查已跳过");
  }

  logBannerEnd();
  return llmConfig;
}

// ---------------------------------------------------------------------------
// 健康检查
// ---------------------------------------------------------------------------

/**
 * 向 LLM 发送最小请求，验证 API Key / Endpoint 可用性。
 * 成功 → 正常返回；失败 → 抛出包含原始错误信息的异常。
 */
async function pingLLM(): Promise<void> {
  const response = await complete({
    messages: [{ role: "user", content: "ok" }],
  });

  if (!response || response.trim().length === 0) {
    throw new Error("LLM 返回了空响应，请检查 API Key 是否有效或账户余额是否充足");
  }
}

// ---------------------------------------------------------------------------
// 日志输出
// ---------------------------------------------------------------------------

const PREFIX = "[Event Chronicle]";

function log(mark: string, message: string): void {
  console.log(`${PREFIX} ${mark.padEnd(2)} ${message}`);
}

function logBanner(): void {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║          Event Chronicle 启动…           ║");
  console.log("╚══════════════════════════════════════════╝");
}

function logBannerEnd(): void {
  console.log(`${PREFIX} 🚀 启动完成，可以开始提取事件\n`);
}

// ---------------------------------------------------------------------------
// 直接运行入口（`npx tsx index.ts` 或 `node index.js`）
// ---------------------------------------------------------------------------

const isMain =
  process.argv[1] &&
  (process.argv[1].replace(/\\/g, "/").endsWith("/index.ts") ||
    process.argv[1].replace(/\\/g, "/").endsWith("/index.js"));

if (isMain) {
  startup().catch((err) => {
    console.error(`${PREFIX} ❌ 启动失败:`, err instanceof Error ? err.message : err);
    logger.error("startup", "fatal startup error", { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
}
