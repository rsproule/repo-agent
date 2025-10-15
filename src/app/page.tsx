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
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { EchoAccount } from "@/components/echo-account-next";
import type { TextUIPart, ToolUIPart } from "ai";
import { DefaultChatTransport } from "ai";
import { useChat } from "ai-sdk-tools/client";
import { Github } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function HomePage() {
  const [text, setText] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/agent",
    }),
  });

  useEffect(() => {
    console.log("Messages:", messages);
    console.log("Status:", status);
    if (error) {
      console.error("Chat error:", error);
    }
  }, [messages, status, error]);

  const handleSubmit = (message: PromptInputMessage) => {
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

  const hasMessages = messages.length > 0;

  // Helper to get text content from message parts
  const getMessageText = (message: (typeof messages)[0]) => {
    const textParts =
      message.parts?.filter((part) => part.type === "text") ?? [];
    return textParts.map((part) => (part as TextUIPart).text).join("");
  };

  // Helper to get tool parts from message
  const getToolParts = (message: (typeof messages)[0]) => {
    return (message.parts?.filter((part) => part.type.startsWith("tool-")) ??
      []) as ToolUIPart[];
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <div className="flex items-center justify-between w-full">
          <div className="text-lg font-semibold">GitHub Assistant</div>
          <EchoAccount />
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-4xl mx-auto">
            {!hasMessages && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="space-y-2">
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
              {messages.map((message, i) => {
                const messageText = getMessageText(message);
                const toolParts = getToolParts(message);

                return (
                  <Message key={i} from={message.role}>
                    <MessageContent>
                      {/* Display text content */}
                      {messageText && (
                        <>
                          {message.role === "assistant" ? (
                            <Response>{messageText}</Response>
                          ) : (
                            messageText
                          )}
                        </>
                      )}

                      {/* Display tool calls */}
                      {toolParts.map((tool, toolIndex) => (
                        <Tool key={toolIndex}>
                          <ToolHeader
                            title={tool.toolName}
                            type={tool.type}
                            state={tool.state}
                          />
                          <ToolContent>
                            {tool.input && <ToolInput input={tool.input} />}
                            {(tool.output || tool.errorText) && (
                              <ToolOutput
                                output={tool.output}
                                errorText={tool.errorText}
                              />
                            )}
                          </ToolContent>
                        </Tool>
                      ))}
                    </MessageContent>
                  </Message>
                );
              })}

              {status === "streaming" && (
                <Message from="assistant">
                  <MessageContent>
                    <Reasoning>Thinking...</Reasoning>
                  </MessageContent>
                </Message>
              )}

              {error && (
                <Message from="assistant">
                  <MessageContent>
                    <div className="text-destructive">
                      Error: {error.message || "Something went wrong"}
                    </div>
                  </MessageContent>
                </Message>
              )}
            </Conversation>
          </div>
        </div>

        <div className="border-t bg-background p-4">
          <div className="max-w-4xl mx-auto">
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
    </div>
  );
}
