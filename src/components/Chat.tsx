"use client";
// src/components/Chat.tsx
import { useState, useEffect, useRef } from "react";
import { MessageService } from "../services/MessageService";
import { OpenAIAdapter } from "../adapters/OpenAIAdapter";
import { StreamEvent } from "../types/stream";

const API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || "";

export default function Chat() {
  const [messages, setMessages] = useState<
    Array<{ role: string; content: string }>
  >([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageService = useRef<MessageService>();
  const currentAssistantMessage = useRef<string>("");

  useEffect(() => {
    messageService.current = new MessageService(new OpenAIAdapter(), API_KEY);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    // 添加用户消息
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    // 预先添加一个空的 assistant 消息
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const stream = messageService.current!.streamChat(userMessage);

      for await (const event of stream) {
        switch (event.type) {
          case "text_delta":
            setMessages((prev) => {
              const newMessages = [...prev];
              // 更新最后一条 assistant 消息
              const lastMsg = newMessages[newMessages.length - 1];
              if (lastMsg && lastMsg.role === "assistant") {
                lastMsg.content += event.payload.text;
              }
              return newMessages;
            });
            break;

          case "tool_call_start":
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                content: `调用工具: ${event.payload.toolName}`,
              },
            ]);
            // 添加新的空 assistant 消息为后续响应做准备
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "" },
            ]);
            break;

          case "tool_call_complete":
            if (event.payload.error) {
              setMessages((prev) => [
                ...prev,
                {
                  role: "system",
                  content: `工具调用失败: ${event.payload.error}`,
                },
              ]);
            } else {
              setMessages((prev) => [
                ...prev,
                {
                  role: "system",
                  content: `工具调用结果: ${JSON.stringify(
                    event.payload.result,
                    null,
                    2
                  )}`,
                },
              ]);
            }
            break;
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: `Error: ${error.message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={`${msg.role}-${idx}`}
              className={`p-4 rounded-lg ${
                msg.role === "user"
                  ? "bg-blue-500 text-white ml-auto"
                  : msg.role === "system"
                  ? "bg-gray-200 text-gray-800"
                  : "bg-white text-gray-800"
              } max-w-[80%] ${msg.role === "user" ? "ml-auto" : "mr-auto"}`}
            >
              {msg.content}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border-t bg-white p-4">
        <div className="max-w-3xl mx-auto flex gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-lg border p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
