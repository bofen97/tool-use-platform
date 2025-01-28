// src/services/ApiService.ts
import { tools, claudeTools, toolImplementations } from "../config/tools";

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
        model: "claude-3-opus-20240229",
        messages,
        stream: true,
        tools: claudeTools,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.body;
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
