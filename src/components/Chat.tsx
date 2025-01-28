"use client";
import { useState, useEffect, useRef } from "react";
import { MessageService } from "../services/MessageService";
import { OpenAIAdapter } from "../adapters/OpenAIAdapter";
import { AnthropicAdapter } from "../adapters/AnthropicAdapter";
import { Switch } from "@headlessui/react";
import { Send } from "lucide-react";

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
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700">
                Current Provider:
              </span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  useOpenAI
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-purple-100 text-purple-800"
                }`}
              >
                {useOpenAI ? "OpenAI" : "Anthropic"}
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <span
                className={`text-sm ${
                  !useOpenAI && "font-medium text-purple-800"
                }`}
              >
                Anthropic
              </span>
              <Switch
                checked={useOpenAI}
                onChange={setUseOpenAI}
                className={`${
                  useOpenAI ? "bg-emerald-500" : "bg-purple-500"
                } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
              >
                <span
                  className={`${
                    useOpenAI ? "translate-x-6" : "translate-x-1"
                  } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                />
              </Switch>
              <span
                className={`text-sm ${
                  useOpenAI && "font-medium text-emerald-800"
                }`}
              >
                OpenAI
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-5xl mx-auto space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={`${msg.role}-${idx}`}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`p-4 rounded-2xl max-w-[80%] shadow-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : msg.role === "system"
                    ? "bg-red-100 text-red-800 border border-red-200"
                    : "bg-white text-gray-800 border border-gray-100"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white p-4">
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-gray-300 transition-colors p-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-2 py-2 bg-transparent focus:outline-none text-gray-800 placeholder-gray-400"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading}
              className={`p-2 rounded-xl ${
                isLoading || !input.trim()
                  ? "text-gray-400 bg-gray-100"
                  : "text-white bg-blue-600 hover:bg-blue-700"
              } transition-colors`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
