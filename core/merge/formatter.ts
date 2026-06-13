import type { Event } from "../../types";

/**
 * 将事件数组格式化为 JSON 字符串，用于填入 merge prompt 的
 * `{{existingEvents}}` 和 `{{newEvents}}` 占位符。
 */
export function formatEvents(events: readonly Event[]): string {
  return JSON.stringify(events, null, 2);
}

/**
 * 截取已有事件中最新的 M 条（窗口约束）。
 *
 * 假设 events 按时间顺序排列（旧→新），返回尾部最近 N 条。
 * 数组长度 ≤ windowSize 时返回完整数组。
 */
export function applyWindow(events: Event[], windowSize: number): Event[] {
  if (events.length <= windowSize) return events;
  return events.slice(events.length - windowSize);
}
