import type { ChatMessage } from "../../types";

/**
 * 将消息列表格式化为聊天记录文本，用于填入 Prompt 的
 * `{{recentMessages}}` 占位符。
 *
 * 输入示例：
 *   [
 *     { role: "user",      content: "最近开始学习Vue" },
 *     { role: "assistant", content: "Vue是一个前端框架" },
 *   ]
 *
 * 输出示例：
 *   user:
 *   最近开始学习Vue
 *
 *   assistant:
 *   Vue是一个前端框架
 */
export function formatMessages(messages: readonly ChatMessage[]): string {
  return messages
    .map((msg) => `${msg.role}:\n${msg.content}`)
    .join("\n\n");
}
