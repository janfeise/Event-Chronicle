// ============================================================================
// parseInstructions — 浏览器安全版
//
// 移植自 core/merge/parser.ts，将 logger.warn 替换为 console.warn。
// 解析逻辑完全一致，不依赖任何 Node.js API。
// ============================================================================

import type { MergeInstruction } from "../../types";

/**
 * 解析 LLM 返回的合并指令 JSON。
 *
 * 兼容纯 JSON 数组和被 ```json ... ``` 包裹的 JSON。
 * 逐条校验指令格式，无效条目跳过并记录警告。
 *
 * @throws 若响应整体无法解析为 JSON 数组
 */
export function parseInstructions(response: string): MergeInstruction[] {
  const trimmed = response.trim();

  const codeBlock = extractCodeBlock(trimmed);
  const json = codeBlock ?? trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      `Failed to parse merge response as JSON. ` +
        `Raw (first 200 chars): ${trimmed.slice(0, 200)}`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      `Merge response must be a JSON array, got ${typeof parsed}`,
    );
  }

  return parsed.filter((item): item is MergeInstruction => {
    if (typeof item !== "object" || item === null) {
      console.warn("[EC:SDK] Skipping non-object instruction", { item });
      return false;
    }

    const inst = item as Record<string, unknown>;
    const action = inst.action;

    if (
      action !== "update" &&
      action !== "delete" &&
      action !== "add" &&
      action !== "keep"
    ) {
      console.warn("[EC:SDK] Unknown action, skipping", { action: String(action) });
      return false;
    }

    if (
      (action === "update" || action === "delete") &&
      typeof inst.id !== "string"
    ) {
      console.warn(`[EC:SDK] ${action} instruction missing valid id, skipping`);
      return false;
    }

    if (
      action === "update" &&
      (typeof inst.changes !== "object" || inst.changes === null)
    ) {
      console.warn("[EC:SDK] update instruction missing changes object, skipping");
      return false;
    }

    if (
      action === "add" &&
      (typeof inst.event !== "object" || inst.event === null)
    ) {
      console.warn("[EC:SDK] add instruction missing event object, skipping");
      return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// 内部
// ---------------------------------------------------------------------------

function extractCodeBlock(text: string): string | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}
