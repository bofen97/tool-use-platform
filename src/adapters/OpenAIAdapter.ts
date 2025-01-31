// src/adapters/OpenAIAdapter.ts
import { LLMAdapter, StreamProcessor } from "./base";
import {
  UnifiedMessage,
  UnifiedContent,
  UnifiedToolCall,
} from "../types/message";
import { StreamEvent } from "../types/stream";
import { log } from "console";

export class OpenAIAdapter implements LLMAdapter {
  convertToProviderFormat(messages: UnifiedMessage[]): any[] {
    return messages.map((msg) => {
      // 处理工具结果消息
      if (msg.role === "tool" && msg.content[0]?.type === "tool_result") {
        return {
          role: "tool",
          tool_call_id: msg.content[0].toolUseId,
          content: (msg.content[0].content[0] as any).text,
        };
      }

      // 处理其他类型的消息
      const formattedMessage: any = {
        role: msg.role,
        content: msg.content
          .filter((c) => c.type === "text")
          .map((c) => (c as any).text)
          .join("\n"),
      };

      // 只有当toolCalls存在且非空时才添加到消息中
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        formattedMessage.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.callId,
          type: "function",
          function: {
            name: tc.toolName,
            arguments: JSON.stringify(tc.parameters),
          },
        }));
      }

      return formattedMessage;
    });
  }

  convertFromProviderFormat(response: any): UnifiedMessage {
    const content: UnifiedContent[] = [];

    if (response.content) {
      content.push({
        type: "text",
        text: response.content,
      });
    }

    const toolCalls = response.tool_calls?.map((tc) => ({
      callId: tc.id,
      toolName: tc.function.name,
      parameters: JSON.parse(tc.function.arguments),
    }));

    return {
      role: response.role,
      content,
      toolCalls,
    };
  }

  createStreamProcessor(): StreamProcessor {
    const currentMessage: UnifiedMessage = {
      role: "assistant",
      content: [],
    };

    const currentToolCalls: Map<string, UnifiedToolCall> = new Map();
    const argumentsBuffer: Map<string, string> = new Map();
    // 添加一个变量来跟踪当前正在处理的tool call id
    let currentToolCallId: string | null = null;

    return {
      processChunk(chunk: any): StreamEvent[] {
        console.log("chunk", chunk);
        const events: StreamEvent[] = [];
        if (!chunk.choices?.[0]?.delta) return events;

        const { delta } = chunk.choices[0];

        if (delta.role) {
          currentMessage.role = delta.role;
        }

        if (delta?.content) {
          //init content ,"".
          if (!currentMessage.content.length) {
            currentMessage.content.push({
              type: "text",
              text: delta.content,
            });
          } else {
            currentMessage.content[0].text += delta.content;
          }
          events.push({
            type: "text_delta",
            payload: { text: delta.content },
          });
        }

        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            // 如果有id，说明是新的tool call开始
            if (toolCall.id) {
              currentToolCallId = toolCall.id;
              currentToolCalls.set(currentToolCallId, {
                callId: currentToolCallId,
                toolName: toolCall.function?.name || "",
                //init parameters,{}
                parameters: {},
              });
              argumentsBuffer.set(currentToolCallId, "");

              if (toolCall.function?.name) {
                events.push({
                  type: "tool_call_start",
                  payload: {
                    callId: currentToolCallId,
                    toolName: toolCall.function.name,
                  },
                });
              }
            }

            // 处理参数，使用currentToolCallId
            if (toolCall.function?.arguments && currentToolCallId) {
              const buffer = argumentsBuffer.get(currentToolCallId) || "";
              const newBuffer = buffer + toolCall.function.arguments;
              argumentsBuffer.set(currentToolCallId, newBuffer);

              try {
                const parsedParams = JSON.parse(newBuffer);
                if (typeof parsedParams === "object") {
                  const current = currentToolCalls.get(currentToolCallId)!;
                  current.parameters = parsedParams;
                  events.push({
                    type: "tool_call_delta",
                    payload: {
                      callId: currentToolCallId,
                      parameters: parsedParams,
                    },
                  });
                }
              } catch (e) {
                // JSON 还不完整，继续累积
              }
            }
          }
        }

        return events;
      },

      finalize() {
        // 最终处理所有工具调用
        for (const [callId, toolCall] of currentToolCalls.entries()) {
          const finalArgs = argumentsBuffer.get(callId) || "{}";
          try {
            toolCall.parameters = JSON.parse(finalArgs);
          } catch (e) {
            console.error(
              `Failed to parse final arguments for tool call ${callId}:`,
              e
            );
            toolCall.parameters = {};
          }
        }

        currentMessage.toolCalls = Array.from(currentToolCalls.values());

        return {
          completedMessage: currentMessage,
          toolCalls: currentMessage.toolCalls || [],
        };
      },
    };
  }
}
