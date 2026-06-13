// openai sdk 封装
import { OpenAI } from "openai";
import type { ChatMessage, LLMOptions, LLMConfig } from "../../types";

export class OpenAIClient {
  private client: OpenAI;

  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async complete(options: LLMOptions): Promise<string> {
    const { messages } = options;

    const response = await this.client.chat.completions.create({
      model: this.config.model,

      temperature: this.config.temperature ?? 0,

      // ChatMessage.role 已放宽为 string，调用方保证传入合法角色值
      messages: messages as any,
    });
    return response.choices[0].message.content ?? "";
  }
}
