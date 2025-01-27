// src/types/message.ts
export type Role = "user" | "assistant" | "system" | "tool";
export type ContentType = "text" | "image" | "tool_use" | "tool_result";

export interface BaseContent {
  type: ContentType;
}

export interface TextContent extends BaseContent {
  type: "text";
  text: string;
}

export interface ImageContent extends BaseContent {
  type: "image";
  data: string;
  mediaType: string;
}

export interface ToolUseContent extends BaseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResultContent extends BaseContent {
  type: "tool_result";
  toolUseId: string;
  content: Array<TextContent | ImageContent>;
}

export type UnifiedContent =
  | TextContent
  | ImageContent
  | ToolUseContent
  | ToolResultContent;

export interface UnifiedMessage {
  role: Role;
  content: UnifiedContent[];
  toolCalls?: UnifiedToolCall[];
}

export interface UnifiedToolCall {
  callId: string;
  toolName: string;
  parameters: Record<string, any>;
}

export interface UnifiedToolResult {
  callId: string;
  content: string;
  success: boolean;
}
