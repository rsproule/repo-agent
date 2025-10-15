"use client";

import GithubConnectionsModal from "@/app/components/github-connections-modal";
import { Conversation } from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Reasoning } from "@/components/ai-elements/reasoning";
import { Response } from "@/components/ai-elements/response";
import type { ToolUIPart } from "ai";
import { DefaultChatTransport } from "ai";
import { useChat } from "ai-sdk-tools/client";
import { Github } from "lucide-react";
import { useRef, useState } from "react";

export default function HomePage() {
  const [text, setText] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/agent",
    }),
  });

  const handleSubmit = (message: PromptInputMessage) => {
    // If currently streaming or submitted, stop instead of submitting
    if (status === "streaming" || status === "submitted") {
      stop();
      return;
    }

    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    sendMessage(message);
    setText("");
  };

  // Derive current tool call from messages
  const currentToolCall = (() => {
    if (messages.length === 0) return null;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "assistant") return null;

    const textParts =
      lastMessage.parts?.filter((part) => part.type === "text") ?? [];
    const hasTextContent = textParts.some((part) => {
      const textPart = part as { text?: string };
      return textPart.text?.trim();
    });

    if (hasTextContent) return null;

    const toolParts = (lastMessage.parts?.filter((part) =>
      part.type.startsWith("tool-"),
    ) ?? []) as ToolUIPart[];

    const latestTool = toolParts[toolParts.length - 1];
    if (!latestTool) return null;

    const toolType = latestTool.type as string;
    if (toolType === "dynamic-tool") {
      const dynamicTool = latestTool as unknown as { toolName: string };
      return dynamicTool.toolName;
    }
    return toolType.replace(/^tool-/, "");
  })();

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Chat Area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 pb-8">
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] text-center">
              <div className="space-y-2 mb-8">
                <h2 className="text-2xl font-bold">
                  Welcome to GitHub Assistant
                </h2>
                <p className="text-muted-foreground">
                  Ask me anything about your GitHub repositories
                </p>
              </div>
            </div>
          )}

          <Conversation>
            {messages.map((message, i) => (
              <Message key={i} from={message.role}>
                <MessageContent>
                  {message.role === "assistant" ? (
                    <Response>{message.content}</Response>
                  ) : (
                    message.content
                  )}
                </MessageContent>
              </Message>
            ))}

            {status === "streaming" && (
              <Message from="assistant">
                <MessageContent>
                  {currentToolCall ? (
                    <Reasoning>Using {currentToolCall}...</Reasoning>
                  ) : (
                    <Reasoning>Thinking...</Reasoning>
                  )}
                </MessageContent>
              </Message>
            )}
          </Conversation>
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto p-4">
          <PromptInput multiple globalDrop onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputAttachments>
                {(attachment) => <PromptInputAttachment data={attachment} />}
              </PromptInputAttachments>
              <PromptInputTextarea
                onChange={(e) => setText(e.target.value)}
                ref={textareaRef}
                value={text}
                placeholder="Ask me anything about your GitHub repositories..."
              />
            </PromptInputBody>
            <PromptInputToolbar>
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
                <GithubConnectionsModal
                  trigger={
                    <PromptInputButton>
                      <Github size={16} />
                      <span>GitHub</span>
                    </PromptInputButton>
                  }
                />
              </PromptInputTools>
              <PromptInputSubmit status={status} />
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
