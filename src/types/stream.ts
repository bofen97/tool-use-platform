// src/types/stream.ts
export type StreamEventType =
  | "text_delta"
  | "tool_call_start"
  | "tool_call_delta";

export interface StreamEvent {
  type: StreamEventType;
  payload: any;
}
