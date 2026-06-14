// 读取 env 配置信息，并导出配置
import dotenv from "dotenv";

/**
 * 加载 .env 文件到 process.env。
 *
 * 不再在模块加载时自动调用——改为由 startup() 或使用者显式调用。
 * 使用者也可以完全跳过此函数，通过 startup({ llmConfig: {...} }) 直接传配置。
 */
export function loadEnv(): void {
  dotenv.config();
}

/**
 * 全局配置对象。
 *
 * 所有属性通过 getter 惰性求值——每次访问实时读取 process.env，
 * 而非在模块加载时固化。这样使用者可以在 import 之后、
 * startup() 之前调用 dotenv.config() 或直接设置 process.env。
 */
export const config = {
  /** 全局默认 event_id，对应 env 中的 CHRONICLE_EVENT_ID，未配置时为 undefined */
  get defaultEventId(): string | undefined {
    return process.env.CHRONICLE_EVENT_ID || undefined;
  },

  /** 事件合并时取最近 N 条已有事件作为上下文窗口，默认 20 */
  get mergeWindowSize(): number {
    return process.env.CHRONICLE_MERGE_WINDOW
      ? parseInt(process.env.CHRONICLE_MERGE_WINDOW, 10)
      : 20;
  },

  /** 累计新增 N 条事件后自动触发合并，默认 5；设为 0 禁用自动合并 */
  get mergeTriggerThreshold(): number {
    return process.env.CHRONICLE_MERGE_TRIGGER
      ? parseInt(process.env.CHRONICLE_MERGE_TRIGGER, 10)
      : 5;
  },

  get llm() {
    return {
      get provider() { return process.env.LLM_PROVIDER || "openai"; },
      get apiKey() { return process.env.LLM_API_KEY || ""; },
      get baseUrl() { return process.env.LLM_BASE_URL || "https://api.openai.com/v1"; },
      get model() { return process.env.LLM_MODEL || "gpt-4o"; },
      get temperature() { return process.env.LLM_TEMPERATURE ? parseFloat(process.env.LLM_TEMPERATURE) : 0; },
      get maxTokens() { return process.env.LLM_MAX_TOKENS ? parseInt(process.env.LLM_MAX_TOKENS, 10) : 2048; },
      get timeout() { return process.env.LLM_TIMEOUT ? parseInt(process.env.LLM_TIMEOUT, 10) : 30000; },
    };
  },
};
