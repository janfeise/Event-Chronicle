import type { Event } from "../../types";

/**
 * 解析 LLM 返回的原始文本，提取事件数组。
 *
 * 兼容以下情况：
 *   - 纯 JSON 数组
 *   - 被 ```json ... ``` 或 ``` ... ``` 包裹的 JSON 数组
 *
 * @param response - LLM 完整响应文本
 * @returns 解析后的 Event 数组
 * @throws 若响应无法解析为合法的事件数组
 */
export function parseEvents(response: string): Event[] {
  const trimmed = response.trim();

  // 尝试提取 markdown 代码块中的 JSON
  const codeBlock = extractCodeBlock(trimmed);
  const json = codeBlock ?? trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      `Failed to parse extractor response as JSON. ` +
        `Raw (first 200 chars): ${trimmed.slice(0, 200)}`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      `Extractor response must be a JSON array, got ${typeof parsed}`,
    );
  }

  return parsed as Event[];
}

// ---------------------------------------------------------------------------
// 内部
// ---------------------------------------------------------------------------

/**
 * 从文本中提取代码块内容。
 * 支持 ```json ... ``` 和 ``` ... ``` 两种写法。
 */
function extractCodeBlock(text: string): string | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}
