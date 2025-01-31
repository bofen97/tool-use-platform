// src/services/ApiService.ts
import { tools, claudeTools, toolImplementations } from "../config/tools";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
export class ApiService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async createOpenAIStream(messages: any[]) {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: messages,
        stream: true,
        tools: tools,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(
        `API error ${response.status}: ${
          error?.error?.message || response.statusText
        }`
      );
    }

    return response.body;
  }

  async createOpenAIClientStream(messages: any[]) {
    const openai = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true,
    });

    const stream = await openai.chat.completions.create({
      messages,
      model: "deepseek-chat",
      tools: tools as OpenAI.Chat.ChatCompletionTool[],
      stream: true,
    });

    return stream;
  }

  async createAnthropicStream(messages: any[]) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        messages,
        stream: true,
        tools: claudeTools,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.body;
  }

  async createAnthropicClientStream(messages: any[]) {
    const anthropic = new Anthropic({
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true,
    });

    const stream = await anthropic.messages.stream({
      model: "claude-3-5-sonnet-20241022",
      messages: messages,
      max_tokens: 1024,
      tools: claudeTools as Anthropic.Tool[],
    });

    return stream;
  }

  async executeTool(toolName: string, parameters: any) {
    const implementation =
      toolImplementations[toolName as keyof typeof toolImplementations];
    if (!implementation) {
      throw new Error(`Tool ${toolName} not found`);
    }

    try {
      return await implementation(parameters);
    } catch (error) {
      console.error(`Tool execution error:`, error);
      throw error;
    }
  }
}
