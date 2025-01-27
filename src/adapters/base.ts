// src/adapters/base.ts
import { UnifiedMessage, UnifiedToolCall } from "../types/message";
import { StreamEvent } from "../types/stream";

export interface LLMAdapter {
  convertToProviderFormat(messages: UnifiedMessage[]): any[];
  convertFromProviderFormat(response: any): UnifiedMessage;
  createStreamProcessor(): StreamProcessor;
}

export interface StreamProcessor {
  processChunk(chunk: any): StreamEvent[];
  finalize(): {
    completedMessage: UnifiedMessage;
    toolCalls: UnifiedToolCall[];
  };
}
