import { complete } from "../llm";
import promptManager from "../../prompts/manager";
import { config } from "../../config";
import { formatEvents, applyWindow } from "./formatter";
import { parseInstructions } from "./parser";
import { logger } from "../logger";
import type { Event, MergeInstruction } from "../../types";

// ---------------------------------------------------------------------------
// 合并管道
// ---------------------------------------------------------------------------

/**
 * 将新事件合并到已有编年史中。
 *
 * 流程：
 *   applyWindow → formatEvents → get merge prompt → LLM → parseInstructions
 *   → applyInstructions → Event[]
 *
 * @param existingEvents - 全部已有事件（旧→新）
 * @param newEvents      - 待合并的新事件
 * @returns 合并后的事件数组（旧→新顺序）
 */
export async function mergeEvents(
  existingEvents: Event[],
  newEvents: Event[],
): Promise<Event[]> {
  // 1. 窗口约束：仅取最近 M 条已有事件发给 LLM
  const windowSize = config.mergeWindowSize;
  const windowedExisting = applyWindow(existingEvents, windowSize);

  // 2. 格式化
  const existingJson = formatEvents(windowedExisting);
  const newEventsJson = formatEvents(newEvents);

  // 3. 获取 merge prompt
  const prompt = promptManager.getWithVars("merge-event", {
    existingEvents: existingJson,
    newEvents: newEventsJson,
  });

  // 4. 调用 LLM
  const response = await complete({
    messages: [{ role: "user", content: prompt }],
  });

  // 5. 解析指令
  const instructions = parseInstructions(response);

  // 6. 应用指令
  return applyInstructions(existingEvents, newEvents, instructions);
}

// ---------------------------------------------------------------------------
// 指令执行（纯函数，无 I/O）
// ---------------------------------------------------------------------------

/**
 * 根据合并指令构建最终事件数组。
 *
 * 处理顺序：
 *   1. 从 existingEvents 构建 Map<id, Event>（浅拷贝）
 *   2. 顺序执行指令：update → delete → add → keep
 *   3. 返回 Map.values()（保持插入顺序 = 旧→新）
 *
 * 容错：
 *   - update/delete 的 id 不匹配 → warn + skip
 *   - add 的 event 缺 id → 生成 fallback
 *   - add 的 id 重复 → warn + skip
 */
export function applyInstructions(
  existingEvents: Event[],
  _newEvents: Event[],
  instructions: MergeInstruction[],
): Event[] {
  // 构建 id 索引（浅拷贝，保持插入顺序）
  const map = new Map<string, Event>();
  for (const event of existingEvents) {
    if (!event.id) {
      logger.warn("merge", "Existing event missing id, generating fallback", { title: event.title });
      event.id = generateFallbackId();
    }
    map.set(event.id, { ...event });
  }

  for (const inst of instructions) {
    switch (inst.action) {
      case "update": {
        if (!inst.id) break;
        const target = map.get(inst.id);
        if (!target) {
          logger.warn("merge", "update target not found", { id: inst.id });
          break;
        }
        if (inst.changes) {
          // 浅合并，排除 id（id 不可变）
          const { id: _, ...safeChanges } = inst.changes;
          Object.assign(target, safeChanges);
        }
        break;
      }

      case "delete": {
        if (!inst.id) break;
        if (!map.has(inst.id)) {
          logger.warn("merge", "delete target not found", { id: inst.id });
          break;
        }
        map.delete(inst.id);
        break;
      }

      case "add": {
        if (!inst.event) break;
        const event = { ...inst.event };
        if (!event.id) {
          logger.warn("merge", "add instruction event missing id, generating fallback");
          event.id = generateFallbackId();
        }
        if (map.has(event.id)) {
          logger.warn("merge", "Duplicate add, skipping", { id: event.id });
          break;
        }
        map.set(event.id, event);
        break;
      }

      case "keep":
        // no-op
        break;
    }
  }

  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// 内部
// ---------------------------------------------------------------------------

function generateFallbackId(): string {
  const ts = Date.now();
  const rand = Math.random().toString(16).slice(2, 8);
  return `evt_${ts}_${rand}`;
}
