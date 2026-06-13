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

  console.log(prompt);

  // 3. 调用 LLM（由 core/llm 统一管理）
  const response = await complete({
    messages: [{ role: "user", content: prompt }],
  });

  // 4. 解析结果
  return parseEvents(response);
}
