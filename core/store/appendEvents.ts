import * as fs from "fs";
import * as path from "path";
import { config } from "../../config";
import { getDataDir } from "./runtimeContext";
import { ensureDir } from "./saveChronicle";
import type { Event } from "../../types";

/**
 * 追加模式：将 newEvents 追加写入 chronicle 数据文件。
 *
 * event_id 优先级（三级降级）：
 *   1. 调用方显式传入的 eventId 参数
 *   2. config.defaultEventId（env 中的 CHRONICLE_EVENT_ID）
 *   3. 以上均无 → 自动生成 `event_{时间戳}.json` 新文件
 *
 * —— 当存在有效的 event_id 时 ——
 * - 对应文件已存在 → 读取 → 合并 newEvents → 写回
 * - 对应文件不存在 → 新建文件，写入 newEvents
 *
 * —— 当无 event_id 时 ——
 * - 生成 `event_{时间戳}.json`，写入 newEvents
 *
 * @param newEvents - 要追加的事件数组
 * @param eventId   - 可选，调用方指定的 event_id（第一优先级）
 * @returns 实际写入的文件名
 */
export function appendEvents(newEvents: Event[], eventId?: string): string {
  const dataDir = getDataDir();
  ensureDir(dataDir);

  // 三级降级获取 event_id
  const resolvedId = eventId ?? config.defaultEventId;

  if (resolvedId) {
    const filename = `${resolvedId}.json`;
    const filePath = path.join(dataDir, filename);

    if (fs.existsSync(filePath)) {
      // 文件已存在 → 读取 → 合并 → 写回
      const raw = fs.readFileSync(filePath, "utf-8");
      let existing: Event[] = [];

      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          existing = parsed;
        }
      } catch {
        // 文件内容损坏，视为空数组，覆盖写入
      }

      const merged = [...existing, ...newEvents];
      fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
    } else {
      // 文件不存在 → 新建
      fs.writeFileSync(filePath, JSON.stringify(newEvents, null, 2), "utf-8");
    }

    return filename;
  }

  // 无 event_id → 生成时间戳文件名
  const filename = `event_${Date.now()}.json`;
  const filePath = path.join(dataDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(newEvents, null, 2), "utf-8");

  return filename;
}
