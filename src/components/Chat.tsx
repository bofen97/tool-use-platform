"use client";
import { useState, useEffect, useRef } from "react";
import { MessageService } from "../services/MessageService";
import { OpenAIAdapter } from "../adapters/OpenAIAdapter";

const API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || "";

export default function Chat() {
  const [messages, setMessages] = useState<
    Array<{ role: string; content: string }>
  >([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageService = useRef<MessageService>(null);

  useEffect(() => {
    messageService.current = new MessageService(new OpenAIAdapter(), API_KEY);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      let currentAssistantMessage = "";

      // Create a new message ID for this conversation turn
      const messageId = Date.now().toString();

      // Add initial assistant message
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const stream = messageService.current!.streamChat(userMessage);

      for await (const event of stream) {
        if (event.type === "text_delta") {
          currentAssistantMessage += event.payload.text;

          // Update the last message with the accumulated content
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
      // Add error message to the chat
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
