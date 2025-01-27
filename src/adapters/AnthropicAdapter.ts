// // src/adapters/AnthropicAdapter.ts
// import { LLMAdapter, StreamProcessor } from "./base";
// import { StreamEvent } from "../types/stream";
// import {
//   UnifiedToolCall,
//   UnifiedMessage,
//   UnifiedContent,
// } from "../types/message";

// export class AnthropicAdapter implements LLMAdapter {
//   convertToProviderFormat(messages: UnifiedMessage[]): any[] {
//     return messages.map((msg) => ({
//       role: msg.role,
//       content: msg.content
//         .map((c) => {
//           switch (c.type) {
//             case "text":
//               return { type: "text", text: c.text };
//             case "image":
//               return {
//                 type: "image",
//                 source: {
//                   type: "base64",
//                   media_type: c.mediaType,
//                   data: c.data,
//                 },
//               };
//             case "tool_use":
//               return {
//                 type: "tool_use",
//                 id: c.id,
//                 name: c.name,
//                 input: c.input,
//               };
//             default:
//               return null;
//           }
//         })
//         .filter(Boolean),
//     }));
//   }

//   convertFromProviderFormat(response: any): UnifiedMessage {
//     const content: UnifiedContent[] = [];
//     const toolCalls: UnifiedToolCall[] = [];

//     for (const c of response.content) {
//       switch (c.type) {
//         case "text":
//           content.push({ type: "text", text: c.text });
//           break;
//         case "tool_use":
//           content.push({
//             type: "tool_use",
//             id: c.id,
//             name: c.name,
//             input: c.input,
//           });
//           toolCalls.push({
//             callId: c.id,
//             toolName: c.name,
//             parameters: c.input,
//           });
//           break;
//       }
//     }

//     return {
//       role: response.role,
//       content,
//       toolCalls: toolCalls.length ? toolCalls : undefined,
//     };
//   }

//   createStreamProcessor(): StreamProcessor {
//     let currentMessage: UnifiedMessage = {
//       role: "assistant",
//       content: [],
//     };

//     let currentToolCalls: Map<string, UnifiedToolCall> = new Map();
//     let jsonBuffer: string = "";

//     return {
//       processChunk(chunk: any): StreamEvent[] {
//         const events: StreamEvent[] = [];
//         const event = JSON.parse(chunk.data);

//         switch (event.type) {
//           case "message_start":
//             events.push({
//               type: "message_start",
//               payload: { id: event.message.id },
//             });
//             break;

//           case "content_block_delta":
//             if (event.delta.type === "text_delta") {
//               events.push({
//                 type: "text_delta",
//                 payload: { text: event.delta.text },
//               });

//               if (
//                 !currentMessage.content.length ||
//                 currentMessage.content[0].type !== "text"
//               ) {
//                 currentMessage.content.push({ type: "text", text: "" });
//               }
//               (currentMessage.content[0] as any).text += event.delta.text;
//             } else if (event.delta.type === "tool_use") {
//               jsonBuffer += event.delta.input || "";
//               try {
//                 const input = JSON.parse(jsonBuffer);
//                 const toolCall: UnifiedToolCall = {
//                   callId: event.id,
//                   toolName: event.name,
//                   parameters: input,
//                 };
//                 currentToolCalls.set(event.id, toolCall);
//                 events.push({
//                   type: "tool_call_complete",
//                   payload: toolCall,
//                 });
//                 jsonBuffer = "";
//               } catch {
//                 // 继续累积JSON
//               }
//             }
//             break;
//         }

//         return events;
//       },

//       finalize() {
//         currentMessage.toolCalls = Array.from(currentToolCalls.values());
//         return {
//           completedMessage: currentMessage,
//           toolCalls: currentMessage.toolCalls || [],
//         };
//       },
//     };
//   }
// }
