// 读取 env 配置信息，并导出配置
import dotenv from "dotenv";

dotenv.config();

export const config = {
  /** 全局默认 event_id，对应 env 中的 CHRONICLE_EVENT_ID，未配置时为 undefined */
  defaultEventId: process.env.CHRONICLE_EVENT_ID || undefined,

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
