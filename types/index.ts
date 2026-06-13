//=============================================================================
// 全局类型定义
// =============================================================================

// ---------------------------------------------------------------------------
// 消息
// ---------------------------------------------------------------------------

/**
 * 单条聊天消息。
 *
 * role 放宽为 string 以容纳任意角色名（如 "小明"、"侦探"），
 * 不再限定为 OpenAI 标准角色枚举。实际调用 LLM API 时由调用方
 * 确保角色值合法。
 */
export interface ChatMessage {
  role: string;
  content: string;
}

// ---------------------------------------------------------------------------
// LLM
// ---------------------------------------------------------------------------

/** 传递给 LLM 的调用选项 */
export interface LLMOptions {
  messages: ChatMessage[];
}

/** LLM 提供商配置 */
export interface LLMConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

// ---------------------------------------------------------------------------
// 事件提取
// ---------------------------------------------------------------------------

/**
 * 从聊天中提取出的事件。
 *
 * 与 prompts/extract-event.md / prompts/merge-event.md 约定的 JSON 输出
 * 结构一致。
 */
export interface Event {
  title: string;
  summary: string;
  importance: number;
  participants: string[];
  location: string;
  tags: string[];
}
