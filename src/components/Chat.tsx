"use client";
import { useState, useEffect, useRef } from "react";
import { MessageService } from "../services/MessageService";
import { OpenAIAdapter } from "../adapters/OpenAIAdapter";
import { AnthropicAdapter } from "../adapters/AnthropicAdapter";
import { Switch } from "@headlessui/react";

const ANTHROPIC_API_KEY = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || "";
const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || "";

export default function Chat() {
  const [messages, setMessages] = useState<
    Array<{ role: string; content: string }>
  >([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [useOpenAI, setUseOpenAI] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageService = useRef<MessageService>(null);

  useEffect(() => {
    messageService.current = new MessageService(
      useOpenAI ? new OpenAIAdapter() : new AnthropicAdapter(),
      useOpenAI ? OPENAI_API_KEY : ANTHROPIC_API_KEY
    );
  }, [useOpenAI]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      let currentAssistantMessage = "";
      const messageId = Date.now().toString();
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const stream = messageService.current!.streamChat(userMessage);

      for await (const event of stream) {
        if (event.type === "text_delta") {
          currentAssistantMessage += event.payload.text;

          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === "assistant") {
              lastMessage.content = currentAssistantMessage;
            }
            return newMessages;
          });
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: "An error occurred while processing your message.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="bg-white p-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium">Current Provider:</span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100">
              {useOpenAI ? "OpenAI" : "Anthropic"}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm">Anthropic</span>
            <Switch
              checked={useOpenAI}
              onChange={setUseOpenAI}
              className={`${
                useOpenAI ? "bg-blue-600" : "bg-gray-400"
              } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
            >
              <span
                className={`${
                  useOpenAI ? "translate-x-6" : "translate-x-1"
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </Switch>
            <span className="text-sm">OpenAI</span>
          </div>
        </div>
      </div>

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
