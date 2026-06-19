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
  /** 消息发送时间（Unix 秒级时间戳），用于推导事件发生时间 */
  timestamp?: number;
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
 * id 由程序在提取后注入（非 LLM 生成），格式 `evt_{timestamp}_{random6hex}`。
 * 其余字段与 prompts/extract-event.md / prompts/merge-event.md 约定的 JSON 输出结构一致。
 */
export interface Event {
  id: string;
  title: string;
  summary: string;
  importance: number;
  participants: string[];
  location: string;
  tags: string[];
  /** 事件发生时间（Unix 秒级时间戳） */
  timestamp: number;
  /** 来源消息引用 */
  source?: EventSource;
}

/** 事件来源消息引用 */
export interface EventSource {
  /** 来源消息在聊天中的索引范围 [start, end)，左闭右开 */
  range: [number, number];
  /** 来源消息数量 */
  count: number;
  /** 最后一条消息的前 100 字符（降级显示用） */
  preview?: string;
}

// ---------------------------------------------------------------------------
// 事件合并
// ---------------------------------------------------------------------------

/** 合并指令 —— LLM 输出的最小变更单元，程序据此批量修改已有数据 */
export interface MergeInstruction {
  action: "update" | "delete" | "add" | "keep";
  /** update / delete 时必填 */
  id?: string;
  /** update 时填写变更字段（不含 id，id 不可变） */
  changes?: Partial<Event>;
  /** add 时填写完整新事件 */
  event?: Event;
}

// ---------------------------------------------------------------------------
// 导出
// ---------------------------------------------------------------------------

/** Memory Export 的可选配置 */
export interface MemoryExportOptions {
  /** 标题，默认 "Event Chronicle Memory" */
  title?: string;
  /** 重要事件高亮阈值（importance >= 该值的事件单独列出），默认 7 */
  highlightThreshold?: number;
  /** 是否包含时间线表格，默认 true */
  includeTimeline?: boolean;
  /** 分组依据，默认 "location" */
  groupBy?: "location" | "tags" | "none";
}
