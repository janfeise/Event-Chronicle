// ============================================================================
// applyInstructions — 浏览器安全版
//
// 移植自 core/merge/index.ts，将 logger.warn 替换为 console.warn。
// 纯函数逻辑完全一致，不依赖任何 Node.js API。
// ============================================================================

import type { Event, MergeInstruction } from "../../types";

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
      console.warn("[EC:SDK] Existing event missing id, generating fallback", {
        title: event.title,
      });
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
          console.warn("[EC:SDK] update target not found", { id: inst.id });
          break;
        }
        if (inst.changes) {
          // 浅合并，排除 id（id 不可变）
          const { id: _, ...safeChanges } = inst.changes as Record<string, unknown>;
          Object.assign(target, safeChanges);
        }
        break;
      }

      case "delete": {
        if (!inst.id) break;
        if (!map.has(inst.id)) {
          console.warn("[EC:SDK] delete target not found", { id: inst.id });
          break;
        }
        map.delete(inst.id);
        break;
      }

      case "add": {
        if (!inst.event) break;
        const event = { ...inst.event };
        if (!event.id) {
          console.warn(
            "[EC:SDK] add instruction event missing id, generating fallback",
          );
          event.id = generateFallbackId();
        }
        if (map.has(event.id)) {
          console.warn("[EC:SDK] Duplicate add, skipping", { id: event.id });
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
