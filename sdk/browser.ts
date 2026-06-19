// ============================================================================
// Event Chronicle SDK — Browser Entry Point
//
// 浏览器安全子集，无 Node.js 依赖。
// 纯函数直接 re-export，浏览器专用函数从 sdk/browser/ 导入。
// Prompt 模板以字符串常量导出。
//
// 使用方（ST 扩展）：
//   import { parseEvents, formatMessages, applyInstructions, ... } from 'ec-sdk';
// ============================================================================

// ---------------------------------------------------------------------------
// 纯函数 — 直接 re-export（无任何 Node.js 依赖）
// ---------------------------------------------------------------------------

export { parseEvents } from "../core/extractor/parser";
export { formatMessages } from "../core/extractor/formatter";
export { formatEvents, applyWindow } from "../core/merge/formatter";
export { exportRawFromEvents } from "./browser/raw-exporter";

// ---------------------------------------------------------------------------
// 浏览器安全版 — 原函数依赖 logger，此处替换为 console
// ---------------------------------------------------------------------------

export { parseInstructions } from "./browser/parse-instructions";
export { applyInstructions } from "./browser/apply-instructions";

// ---------------------------------------------------------------------------
// Prompt 模板 — 字符串常量
// ---------------------------------------------------------------------------

export { extractPrompt, mergePrompt, memoryPrompt } from "./browser/prompts";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export type { Event, EventSource, ChatMessage, MergeInstruction, MemoryExportOptions } from "../types";
