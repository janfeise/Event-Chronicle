// 读取 env 配置信息，并导出配置
import dotenv from "dotenv";

dotenv.config();

export const config = {
  /** 全局默认 event_id，对应 env 中的 CHRONICLE_EVENT_ID，未配置时为 undefined */
  defaultEventId: process.env.CHRONICLE_EVENT_ID || undefined,

  /** 事件合并时取最近 N 条已有事件作为上下文窗口，默认 20 */
  mergeWindowSize: process.env.CHRONICLE_MERGE_WINDOW
    ? parseInt(process.env.CHRONICLE_MERGE_WINDOW, 10)
    : 20,

  /** 累计新增 N 条事件后自动触发合并，默认 5；设为 0 禁用自动合并 */
  mergeTriggerThreshold: process.env.CHRONICLE_MERGE_TRIGGER
    ? parseInt(process.env.CHRONICLE_MERGE_TRIGGER, 10)
    : 5,

  llm: {
    provider: process.env.LLM_PROVIDER || "openai",

    apiKey: process.env.LLM_API_KEY || "",

    baseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",

    model: process.env.LLM_MODEL || "gpt-4o",

    temperature: process.env.LLM_TEMPERATURE
      ? parseFloat(process.env.LLM_TEMPERATURE)
      : 0,

    maxTokens: process.env.LLM_MAX_TOKENS
      ? parseInt(process.env.LLM_MAX_TOKENS, 10)
      : 2048,

    timeout: process.env.LLM_TIMEOUT
      ? parseInt(process.env.LLM_TIMEOUT, 10)
      : 30000,
  },
};
