/**
 * core统一入口文件：messages -> llm api -> store events
 */

import { extractEvents } from "./extractor";
import { appendEvents, loadChronicle } from "./store";
import { config } from "../config";
import type { ChatMessage, Event } from "../types";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export interface ProcessOptions {
  /**
   * 指定要加载的已有事件文件（第一优先级）。
   *
   * 传入时 → 从 `data/{existingEventId}.json` 加载 existing 事件供 extractor 参考。
   * 未传入 → 降级到 config.defaultEventId；若仍不存在则不加载。
   */
  existingEventId?: string;

  /**
   * 指定 append 存储时的目标文件（第一优先级）。
   *
   * 传入时 → 写入 `data/{eventId}.json`。
   * 未传入 → 降级到 config.defaultEventId；若仍不存在则由 store 自动生成时间戳文件名。
   */
  eventId?: string;
}

export interface ProcessResult {
  /** 本次提取出的事件 */
  events: Event[];

  /** 事件最终写入的文件名 */
  storedFile: string;
}

// ---------------------------------------------------------------------------
// 管道入口
// ---------------------------------------------------------------------------

/**
 * 完整管道：从聊天消息中提取事件并持久化。
 *
 * ```
 * loadChronicle(existingEventId) → extractEvents() → appendEvents(eventId)
 * ```
 *
 * 使用示例：
 * ```ts
 * // 最简调用 — env 未配置时按时间戳自动命名
 * const { events } = await processMessages(recentMessages);
 *
 * // 多会话场景 — 显式指定同一 chronicle 文件
 * const { events } = await processMessages(recentMessages, {
 *   existingEventId: "session-42",
 *   eventId: "session-42",
 * });
 * ```
 */
export async function processMessages(
  messages: ChatMessage[],
  options: ProcessOptions = {},
): Promise<ProcessResult> {
  // 1. 按需加载已有事件（三级降级：显式参数 → env → 不加载）
  const resolvedExistingId = options.existingEventId ?? config.defaultEventId;
  const existingEvents = loadChronicle(resolvedExistingId);

  // 2. 提取新事件
  const events = await extractEvents(messages, JSON.stringify(existingEvents));

  // 3. 持久化（三级降级：显式参数 → env → undefined → 时间戳命名）
  const resolvedEventId = options.eventId ?? config.defaultEventId;
  const storedFile = appendEvents(events, resolvedEventId);

  return { events, storedFile };
}
