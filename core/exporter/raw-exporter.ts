import { loadChronicle } from "../store";
import type { Event } from "../../types";

/**
 * 结构化 JSON 导出 —— 从 data/{eventId}.json 加载并输出完整 JSON。
 *
 * 用于数据迁移、调试、机器处理。
 */
export function exportRaw(eventId: string): string {
  const events = loadChronicle(eventId);
  return exportRawFromEvents(events);
}

/**
 * 纯函数版本：将 Event[] 序列化为 JSON。
 */
export function exportRawFromEvents(events: Event[]): string {
  return JSON.stringify(events, null, 2);
}
