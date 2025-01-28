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
  private MAX_TOOL_CALL_DEPTH = 10; // 防止无限递归

  constructor(
    adapter: LLMAdapter,
    apiKey: string,
    baseUrl: string = "https://api.deepseek.com"
  ) {
    this.adapter = adapter;
    this.apiService = new ApiService(apiKey, baseUrl);
  }
  private getToolResultRole(): "tool" | "user" {
    // OpenAI 使用 "tool"，Anthropic 使用 "user"
    return this.adapter instanceof OpenAIAdapter ? "tool" : "user";
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
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() === "" || line.trim() === "data: [DONE]") continue;

          try {
            // Handle format 1: event + data structure
            if (line.startsWith("event: ")) {
              const nextLine = lines[lines.indexOf(line) + 1];
              if (nextLine?.startsWith("data: ")) {
                const jsonStr = nextLine.slice(6);
                const json = JSON.parse(jsonStr);
                yield { event: line.slice(7), data: json };
                continue;
              }
            }

            // Handle format 2: data-only structure
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6);
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
  /**
   * 处理单次对话流，返回处理后的消息和工具调用
   */
  private async *processChatStream(
    processor: any,
    stream: ReadableStream
  ): AsyncGenerator<
    StreamEvent,
    { completedMessage: UnifiedMessage; toolCalls: any[] }
  > {
    for await (const chunk of this.parseStream(stream)) {
      const events = processor.processChunk(chunk);
      for (const event of events) {
        yield event;
      }
    }

    const { completedMessage, toolCalls } = processor.finalize();
    yield { completedMessage, toolCalls };
    return { completedMessage, toolCalls };
  }

  /**
   * 递归处理对话和工具调用
   */
  private async *processConversationTurn(
    depth: number = 0
  ): AsyncGenerator<StreamEvent> {
    if (depth >= this.MAX_TOOL_CALL_DEPTH) {
      console.warn("达到最大工具调用深度限制");
      return;
    }

    const processor = this.adapter.createStreamProcessor();
    const providerMessages = this.adapter.convertToProviderFormat(
      this.messages
    );
    console.log("providerMessages", providerMessages);
    const stream =
      this.adapter instanceof OpenAIAdapter
        ? await this.apiService.createOpenAIStream(providerMessages)
        : await this.apiService.createAnthropicStream(providerMessages);

    // 修改这部分代码，使用 for await...of 来处理流
    let completedMessage: UnifiedMessage | undefined;
    let toolCalls: any[] | undefined;

    for await (const result of this.processChatStream(processor, stream)) {
      if ("completedMessage" in result && result.completedMessage) {
        completedMessage = result.completedMessage;
        toolCalls = result.toolCalls;
      } else {
        yield result;
      }
    }

    if (!completedMessage) {
      throw new Error("未能获取完整的消息响应");
    }

    // 将 assistant 消息添加到历史
    this.messages.push(completedMessage);

    // 如果有工具调用，处理它们
    if (toolCalls && toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        try {
          // 执行工具调用
          const result = await this.apiService.executeTool(
            toolCall.toolName,
            toolCall.parameters
          );

          // 添加工具调用结果到消息历史
          //
          const toolResultMessage: UnifiedMessage = {
            role: this.getToolResultRole(), //user for anthropic , tool for openai <--here
            content: [
              {
                type: "tool_result",
                toolUseId: toolCall.callId,
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(result),
                  },
                ],
              },
            ],
          };

          this.messages.push(toolResultMessage);

          // 递归处理下一轮对话
          yield* this.processConversationTurn(depth + 1);
        } catch (error) {
          console.error("Tool execution error:", error);
          // 添加错误消息到历史
          this.messages.push({
            role: "system",
            content: [
              {
                type: "text",
                text: `Error executing tool ${toolCall.toolName}: ${error.message}`,
              },
            ],
          });
        }
      }
    }
  }

  async *streamChat(message: string): AsyncGenerator<StreamEvent> {
    try {
      // 添加用户消息到历史
      const userMessage: UnifiedMessage = {
        role: "user",
        content: [{ type: "text", text: message }],
      };
      this.messages.push(userMessage);

      // 开始处理对话轮次
      yield* this.processConversationTurn();
    } catch (error) {
      console.error("Stream processing error:", error);
      throw error;
    }
  }

  getMessages() {
    return this.messages;
  }
}
