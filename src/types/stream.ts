// src/types/stream.ts
export type StreamEventType =
  | "message_start"
  | "content_start"
  | "text_delta"
  | "tool_call_start"
  | "tool_call_delta"
  | "content_end"
  | "message_complete";

export interface StreamEvent {
  type: StreamEventType;
  payload: any;
}
