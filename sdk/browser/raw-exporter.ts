// ============================================================================
// exportRawFromEvents — 浏览器安全版
//
// 移植自 core/exporter/raw-exporter.ts 的纯函数部分。
// 原文件还包含依赖 loadChronicle (fs) 的 exportRaw()，此处仅导出纯函数。
// ============================================================================

import type { Event } from "../../types";

/**
 * 纯函数版本：将 Event[] 序列化为 JSON。
 */
export function exportRawFromEvents(events: Event[]): string {
  return JSON.stringify(events, null, 2);
}
