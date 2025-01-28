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
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content
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
            default:
              return null;
          }
        })
        .filter(Boolean),
    }));
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

        // Handle message_start event
        if (chunk.event === "message_start") {
          const messageData = chunk.data?.message;
          if (messageData) {
            currentMessage.role = messageData.role;
          }
        }

        // Handle content_block_start event
        if (chunk.event === "content_block_start") {
          const blockData = chunk.data?.content_block;
          currentContentIndex = chunk.data?.index;

          if (blockData?.type === "text") {
            // Initialize text content block
            currentMessage.content.push({
              type: "text",
              text: "",
            });
          } else if (blockData?.type === "tool_use") {
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
        if (chunk.event === "content_block_delta") {
          const deltaData = chunk.data?.delta;
          if (deltaData?.type === "text_delta") {
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
          } else if (
            deltaData?.type === "input_json_delta" &&
            currentToolCall
          ) {
            // Handle tool call parameter delta
            jsonBuffer += deltaData.partial_json;
            //参数收集的不完整就所以从控制台来看 是空的{}.
            // {"location
            // "uni
            // 然后就退出了。
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
        if (chunk.event === "content_block_stop") {
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
