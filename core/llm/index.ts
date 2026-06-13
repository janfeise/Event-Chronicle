// 统一入口文件
import { OpenAIClient } from "./openai-client";

import type { ChatMessage, LLMConfig } from "../../types";

let client: OpenAIClient;

export function initLLM(config: LLMConfig) {
  client = new OpenAIClient(config);
}

export async function complete(options: {
  messages: ChatMessage[];
}): Promise<string> {
  if (!client) {
    throw new Error(
      "LLM client is not initialized. Please call initLLM first.",
    );
  }

  return client.complete(options);
}
