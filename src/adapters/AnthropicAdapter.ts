// src/adapters/AnthropicAdapter.ts
import { LLMAdapter, StreamProcessor } from "./base";
import { StreamEvent } from "../types/stream";
import {
  UnifiedToolCall,
  UnifiedMessage,
  UnifiedContent,
} from "../types/message";

export class AnthropicAdapter implements LLMAdapter {
  convertToProviderFormat(messages: UnifiedMessage[]): any[] {
    return messages.map((msg) => {
      // 创建基本内容数组
      const baseContent = msg.content
        .map((c) => {
          switch (c.type) {
            case "text":
              return { type: "text", text: c.text };
            case "image":
              return {
                type: "image",
                source: {
                  type: "base64",
                  media_type: c.mediaType,
                  data: c.data,
                },
              };
            case "tool_use":
              return {
                type: "tool_use",
                id: c.id,
                name: c.name,
                input: c.input,
              };
            case "tool_result":
              return {
                type: "tool_result",
                tool_use_id: c.toolUseId,
                content: c.content,
              };
            default:
              return null;
          }
        })
        .filter(Boolean);

      // 如果存在 toolCalls，将其转换为 tool_use 类型并添加到 content 末尾
      const toolCallsContent =
        msg.toolCalls?.map((toolCall) => ({
          type: "tool_use" as const,
          id: toolCall.callId,
          name: toolCall.toolName,
          input: toolCall.parameters,
        })) || [];

      return {
        role: msg.role,
        content: [...baseContent, ...toolCallsContent],
      };
    });
  }

  convertFromProviderFormat(response: any): UnifiedMessage {
    const content: UnifiedContent[] = [];
    const toolCalls: UnifiedToolCall[] = [];

    for (const c of response.content) {
      switch (c.type) {
        case "text":
          content.push({ type: "text", text: c.text });
          break;
        case "tool_use":
          content.push({
            type: "tool_use",
            id: c.id,
            name: c.name,
            input: c.input,
          });
          toolCalls.push({
            callId: c.id,
            toolName: c.name,
            parameters: c.input,
          });
          break;
      }
    }

    return {
      role: response.role,
      content,
      toolCalls: toolCalls.length ? toolCalls : undefined,
    };
  }

  createStreamProcessor(): StreamProcessor {
    let currentMessage: UnifiedMessage = {
      role: "assistant",
      content: [],
    };

    let currentToolCalls: Map<string, UnifiedToolCall> = new Map();
    let jsonBuffer: string = "";
    let currentToolCall: UnifiedToolCall | null = null;
    let currentContentIndex: number | null = null;

    return {
      processChunk(chunk: any): StreamEvent[] {
        const events: StreamEvent[] = [];
        console.log("chunk", chunk);
        // Handle message_start event
        if (chunk.type === "message_start") {
          const messageData = chunk.message;
          if (messageData) {
            currentMessage.role = messageData.role;
          }
        }

        // Handle content_block_start event
        if (chunk.type === "content_block_start") {
          const blockData = chunk.content_block;
          currentContentIndex = chunk.index;

          if (blockData.type === "text") {
            // Initialize text content block
            currentMessage.content.push({
              type: "text",
              text: "",
            });
          } else if (blockData.type === "tool_use") {
            currentToolCall = {
              callId: blockData.id,
              toolName: blockData.name,
              parameters: {},
            };
            currentToolCalls.set(blockData.id, currentToolCall);

            events.push({
              type: "tool_call_start",
              payload: {
                callId: blockData.id,
                toolName: blockData.name,
              },
            });
          }
        }

        // Handle content_block_delta event
        if (chunk.type === "content_block_delta") {
          const deltaData = chunk.delta;
          if (deltaData.type === "text_delta") {
            // Handle text delta
            const text = deltaData.text;
            if (
              currentContentIndex !== null &&
              currentMessage.content[currentContentIndex]
            ) {
              currentMessage.content[currentContentIndex].text += text;
              events.push({
                type: "text_delta",
                payload: { text },
              });
            }
          } else if (deltaData.type === "input_json_delta" && currentToolCall) {
            // Handle tool call parameter delta
            jsonBuffer += deltaData.partial_json;
            console.log("jsonBuffer", jsonBuffer);
            console.log("deltaData", deltaData.partial_json);
            try {
              const parsedParams = JSON.parse(jsonBuffer);
              if (typeof parsedParams === "object") {
                currentToolCall.parameters = parsedParams;
                console.log("currentToolCall", currentToolCall);
                events.push({
                  type: "tool_call_delta",
                  payload: {
                    callId: currentToolCall.callId,
                    parameters: parsedParams,
                  },
                });
              }
            } catch (e) {
              // JSON is not complete yet, continue accumulating
            }
          }
        }

        // Handle content_block_stop event
        if (chunk.type === "content_block_stop") {
          if (currentToolCall) {
            currentToolCall = null;
            jsonBuffer = "";
          }
          currentContentIndex = null;
        }

        return events;
      },

      finalize() {
        currentMessage.toolCalls = Array.from(currentToolCalls.values());
        console.log("currentMessage", currentMessage);
        console.log("currentToolCalls", currentToolCalls);
        return {
          completedMessage: currentMessage,
          toolCalls: currentMessage.toolCalls || [],
        };
      },
    };
  }
}
