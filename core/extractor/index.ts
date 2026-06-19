import { complete } from "../llm";
import promptManager from "../../prompts/manager";
import { formatMessages } from "./formatter";
import { parseEvents } from "./parser";
import type { ChatMessage, Event } from "../../types";

/**
 * 事件提取器。
 *
 * 流程：
 *   ChatMessage[] → 格式化 → 获取 Prompt → 调用 LLM → 解析 JSON → Event[]
 *
 * 使用前需先初始化 LLM：
 *   import { initLLM } from "../llm";
 *   initLLM({ provider: "...", baseUrl: "...", apiKey: "...", model: "..." });
 *
 * 使用示例：
 *   const events = await extractEvents(recentMessages);
 */
export async function extractEvents(
  messages: ChatMessage[],
  existingEvents?: string,
): Promise<Event[]> {
  // 1. 格式化消息
  const formattedMessages = formatMessages(messages);

  // 2. 获取提示词并替换模板变量
  const prompt = promptManager.getWithVars("extract-event", {
    existingEvents: existingEvents ?? "",
    recentMessages: formattedMessages,
  });

  // 3. 调用 LLM（由 core/llm 统一管理）
  const response = await complete({
    messages: [{ role: "user", content: prompt }],
  });

  // 4. 解析结果
  const events = parseEvents(response);

  // 5. 程序注入 ID + timestamp（非 LLM 生成，减少 token 开销且更可靠）
  const lastTs = findLastTimestamp(messages);
  return injectMetadata(events, lastTs);
}

// ---------------------------------------------------------------------------
// 内部
// ---------------------------------------------------------------------------

/** 从消息列表中提取最后一条消息的时间戳 */
function findLastTimestamp(messages: ChatMessage[]): number | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].timestamp) return messages[i].timestamp;
  }
  return undefined;
}

/** 为每个事件注入唯一 ID 和 timestamp */
function injectMetadata(events: Event[], fallbackTs?: number): Event[] {
  const ts = fallbackTs ?? Math.floor(Date.now() / 1000);
  for (const e of events) {
    e.id = `evt_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    if (!e.timestamp) e.timestamp = ts;
  }
  return events;
}
