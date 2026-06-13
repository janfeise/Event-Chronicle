/**
 * core 统一入口：extract → store → [auto-merge]
 *
 * 管道流程：
 *   messages → extractEvents → appendEvents
 *                                  │
 *                    [newEventCount >= threshold?]
 *                                  │ 是
 *                     loadChronicle → mergeEvents → saveChronicle
 */

import { extractEvents } from "./extractor";
import {
  appendEvents,
  loadChronicle,
  saveChronicle,
  recordNewEvents,
  resetMergeCounter,
} from "./store";
import { mergeEvents } from "./merge";
import { config } from "../config";
import type { ChatMessage, Event } from "../types";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export interface ProcessOptions {
  /**
   * 指定要加载的已有事件文件（第一优先级）。
   * 传入时 → `data/{existingEventId}.json`
   * 未传入 → 降级到 config.defaultEventId；不存在则不加载。
   */
  existingEventId?: string;

  /**
   * 指定 append 存储时的目标文件（第一优先级）。
   * 传入时 → `data/{eventId}.json`
   * 未传入 → 降级到 config.defaultEventId；不存在则由 store 生成时间戳文件名。
   */
  eventId?: string;

  /**
   * 是否启用自动合并（默认 true）。
   *
   * 当累计新增事件数达到 config.mergeTriggerThreshold 时，
   * 自动触发 mergeEvents 并保存合并结果。
   *
   * 设为 false 可完全禁用自动合并。
   */
  autoMerge?: boolean;
}

export interface ProcessResult {
  /** 本次提取出的事件 */
  events: Event[];

  /** 事件写入的文件名 */
  storedFile: string;

  /** 自动合并是否被触发 */
  merged: boolean;

  /** 合并结果（仅 merged=true 时有值） */
  mergedFile?: string;

  /** 合并后的事件数组（仅 merged=true 时有值） */
  mergedEvents?: Event[];
}

// ---------------------------------------------------------------------------
// 管道入口
// ---------------------------------------------------------------------------

export async function processMessages(
  messages: ChatMessage[],
  options: ProcessOptions = {},
): Promise<ProcessResult> {
  const autoMerge = options.autoMerge ?? true;

  // 1. 加载已有事件（供 extractor 参考去重）
  const resolvedExistingId =
    options.existingEventId ?? config.defaultEventId;
  const existingEvents = loadChronicle(resolvedExistingId);

  // 2. 提取新事件
  const events = await extractEvents(
    messages,
    JSON.stringify(existingEvents),
  );

  // 3. 计数器先于事件写入（方案 A）：
  //    若此处崩溃 → 计数器虚高，下次提前触发合并（无害）
  //    若事件先写后崩溃 → 事件已持久化但计数器遗漏（合并延迟）
  const resolvedEventId = options.eventId ?? config.defaultEventId;

  // 4. 自动合并检测
  let merged = false;
  let mergedFile: string | undefined;
  let mergedEvents: Event[] | undefined;

  if (autoMerge && resolvedEventId && events.length > 0) {
    const threshold = config.mergeTriggerThreshold;

    if (threshold > 0) {
      // 4a. 先累加计数（写 data/{id}_state.json）
      const state = recordNewEvents(resolvedEventId, events.length);

      if (state.newEventCount >= threshold) {
        // 4b. 触发合并：读全量 → LLM merge → 写合并结果
        const fullExisting = loadChronicle(resolvedEventId);
        mergedEvents = await mergeEvents(fullExisting, events);
        mergedFile = saveChronicle(mergedEvents);
        resetMergeCounter(resolvedEventId);
        merged = true;
      }
    }
  }

  // 5. 持久化事件（计数器之后写入，确保崩溃时计数器只多不少）
  const storedFile = appendEvents(events, resolvedEventId);

  return { events, storedFile, merged, mergedFile, mergedEvents };
}
