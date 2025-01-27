// src/services/MessageService.ts
import { LLMAdapter } from "../adapters/base";
import { UnifiedMessage } from "../types/message";
import { StreamEvent } from "../types/stream";
import { ApiService } from "./ApiService";
import { OpenAIAdapter } from "../adapters/OpenAIAdapter";

export class MessageService {
  private adapter: LLMAdapter;
  private apiService: ApiService;
  private messages: UnifiedMessage[] = [];

  constructor(
    adapter: LLMAdapter,
    apiKey: string,
    baseUrl: string = "https://api.deepseek.com"
  ) {
    this.adapter = adapter;
    this.apiService = new ApiService(apiKey, baseUrl);
  }

  private async *parseStream(stream: ReadableStream): AsyncGenerator<any> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === "") continue;
          if (line.trim() === "data: [DONE]") continue;

          try {
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6); // Remove 'data: ' prefix
              const json = JSON.parse(jsonStr);
              yield json;
            }
          } catch (e) {
            console.error("Failed to parse JSON:", line, e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async *streamChat(message: string): AsyncGenerator<StreamEvent> {
    const processor = this.adapter.createStreamProcessor();

    try {
      const userMessage: UnifiedMessage = {
        role: "user",
        content: [{ type: "text", text: message }],
      };
      this.messages.push(userMessage);

      const providerMessages = this.adapter.convertToProviderFormat(
        this.messages
      );

      console.log("Sending messages:", providerMessages);

      const stream =
        this.adapter instanceof OpenAIAdapter
          ? await this.apiService.createOpenAIStream(providerMessages)
          : await this.apiService.createAnthropicStream(providerMessages);

      for await (const chunk of this.parseStream(stream)) {
        const events = processor.processChunk(chunk);

        for (const event of events) {
          console.log("event", event); //这儿yield出去的数量是正确的
          yield event;
        }
      }

      const { completedMessage, toolCalls } = processor.finalize();
      console.log("Completed message:", completedMessage);

      this.messages.push(completedMessage);
      //here
      if (toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          try {
            const result = await this.apiService.executeTool(
              toolCall.toolName,
              toolCall.parameters
            );
            console.log("Tool execution result:", result);

            const toolResultMessage: UnifiedMessage = {
              role: "tool",
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result),
                },
              ],
            };

            this.messages.push(toolResultMessage);
          } catch (error) {
            console.error("Tool execution error:", error);
          }
        }
      }
    } catch (error) {
      console.error("Stream processing error:", error);
    }
  }

  getMessages() {
    return this.messages;
  }
}
