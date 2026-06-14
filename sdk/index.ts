// ============================================================================
// Event Chronicle SDK — 统一公共入口
//
// 这是整个 SDK 唯一的对外窗口。
// 使用者的所有导入都从这里来：
//
//   import { startup, processMessages, exportMemory } from "event-chronicle";
//
// 三层 API 设计：
//   第一层：一站式 API（大多数用户只需这两个）
//   第二层：流程级 API（需要自定义流程的高级用户）
//   第三层：底层 API（需要完全控制的高级用户）
// ============================================================================

// ---------------------------------------------------------------------------
// 第一层：一站式 API
// ---------------------------------------------------------------------------

// 启动 / 初始化
export { startup } from "../index";
export type { StartupOptions } from "../index";

// 核心管道
export { processMessages } from "../core";
export type { ProcessOptions, ProcessResult } from "../core";

// 导出（最常用的两个）
export { exportRaw, exportMemory } from "../core/exporter";

// .env 加载（如需从文件读配置）
export { loadEnv } from "../config";

// ---------------------------------------------------------------------------
// 第二层：流程级 API
// ---------------------------------------------------------------------------

// 事件提取（不自动持久化）
export { extractEvents } from "../core/extractor";

// 事件合并（不自动触发）
export { mergeEvents, applyInstructions } from "../core/merge";

// 持久化（手动读写）
export {
  loadChronicle,
  saveChronicle,
  appendEvents,
} from "../core/store";

// 导出（底层纯函数版本）
export { exportRawFromEvents, exportMemoryFromEvents } from "../core/exporter";

// ---------------------------------------------------------------------------
// 第三层：底层 API
// ---------------------------------------------------------------------------

// LLM 客户端（手动初始化 + 直接调用）
export { initLLM, complete } from "../core/llm";

// 合并状态追踪
export { loadMergeState, resetMergeCounter } from "../core/store";

// 运行时路径控制
export { getDataDir, setDataDir } from "../core/store/runtimeContext";

// 提示词管理器（自定义 PromptManager 实例）
export { PromptManager } from "../prompts/manager";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export type {
  Event,
  ChatMessage,
  LLMConfig,
  MemoryExportOptions,
} from "../types";
