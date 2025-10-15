import { type AgentStatus } from "@/types/agents";
import { type Message } from "ai";
import { type RefObject } from "react";

export interface ChatInputMessage {
  text: string;
  agentChoice?: string;
  toolChoice?: string;
  files?: File[];
}

export function ChatHeader() {
  return (
    <div className="border-b">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-xl font-semibold">AI Chat</h1>
      </div>
    </div>
  );
}

export function ChatTitle() {
  return (
    <div className="px-4 py-2">
      <h2 className="text-lg font-medium">Chat Session</h2>
    </div>
  );
}

export function ChatMessages({ messages }: { messages: Message[] }) {
  return (
    <div className="space-y-4 px-4">
      {messages.map((message, i) => (
        <div
          key={i}
          className={`flex ${
            message.role === "assistant" ? "justify-start" : "justify-end"
          }`}
        >
          <div
            className={`rounded-lg px-4 py-2 max-w-[80%] ${
              message.role === "assistant"
                ? "bg-gray-100"
                : "bg-blue-500 text-white"
            }`}
          >
            {message.content}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatStatusIndicators({
  agentStatus,
  currentToolCall,
  status,
}: {
  agentStatus: AgentStatus | null;
  currentToolCall: string | null;
  status: string;
}) {
  if (status !== "streaming") return null;

  return (
    <div className="px-4 py-2 text-sm text-gray-500">
      {agentStatus && (
        <div>
          <span className="font-medium">{agentStatus.agent}</span>:{" "}
          {agentStatus.thought}
        </div>
      )}
      {currentToolCall && (
        <div>
          Using tool: <span className="font-medium">{currentToolCall}</span>
        </div>
      )}
    </div>
  );
}

export function ChatInput({
  text,
  setText,
  textareaRef,
  useWebSearch,
  setUseWebSearch,
  onSubmit,
  status,
  hasMessages,
}: {
  text: string;
  setText: (text: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  useWebSearch: boolean;
  setUseWebSearch: (use: boolean) => void;
  onSubmit: (message: ChatInputMessage) => void;
  status: string;
  hasMessages: boolean;
}) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      text,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={useWebSearch}
          onChange={(e) => setUseWebSearch(e.target.checked)}
          id="web-search"
        />
        <label htmlFor="web-search">Enable web search</label>
      </div>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your message..."
          className="w-full p-2 border rounded-lg pr-20"
          rows={3}
        />
        <button
          type="submit"
          disabled={status === "streaming"}
          className="absolute bottom-2 right-2 px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {status === "streaming" ? "Stop" : "Send"}
        </button>
      </div>
    </form>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-4">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Welcome to AI Chat</h2>
        <p className="text-gray-600">
          Start a conversation with our AI assistant
        </p>
      </div>
      {children}
    </div>
  );
}

export function RateLimitIndicator() {
  return null; // Implement rate limiting UI if needed
}
