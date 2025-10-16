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
import { Response } from "@/components/ai-elements/response";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { EchoAccount } from "@/components/echo-account-next";
import { Badge } from "@/components/ui/badge";
import { useChat } from "@ai-sdk/react";
import { useQuery } from "@tanstack/react-query";
import { DefaultChatTransport, type TextUIPart, type ToolUIPart } from "ai";
import { Folder, Github } from "lucide-react";
import { useRef, useState } from "react";

interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
}

interface Connection {
  installation_id: number;
  account_login?: string | null;
  repositories: Repository[];
}

export default function HomePage() {
  const [text, setText] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: connectionsData } = useQuery({
    queryKey: ["github-connections"],
    queryFn: async () => {
      const res = await fetch("/api/github/connections");
      if (!res.ok) throw new Error("Failed to fetch connections");
      return res.json() as Promise<{ connections: Connection[] }>;
    },
  });

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/agent",
    }),
  });

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);

    if (!hasText) {
      return;
    }

    sendMessage(message);
    setText("");
  };

  const hasMessages = messages.length > 0;
  const connections = connectionsData?.connections ?? [];
  const allRepos = connections.flatMap((c) => c.repositories);

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
                      {/* Display tool calls */}
                      {toolParts.map((tool, toolIndex) => {
                        const toolName = tool.type.replace(/^tool-/, "");
                        return (
                          <Tool key={toolIndex}>
                            <ToolHeader
                              title={toolName}
                              type={tool.type}
                              state={tool.state}
                            />
                            <ToolContent>
                              {"input" in tool && tool.input !== undefined && (
                                <ToolInput input={tool.input} />
                              )}
                              {(("output" in tool &&
                                tool.output !== undefined) ||
                                ("errorText" in tool &&
                                  tool.errorText !== undefined)) && (
                                <ToolOutput
                                  output={
                                    "output" in tool ? tool.output : undefined
                                  }
                                  errorText={
                                    "errorText" in tool
                                      ? tool.errorText
                                      : undefined
                                  }
                                />
                              )}
                            </ToolContent>
                          </Tool>
                        );
                      })}

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
                    </MessageContent>
                  </Message>
                );
              })}
            </Conversation>
          </div>
        </div>

        <div className="border-t bg-background p-4">
          <div className="max-w-4xl mx-auto">
            {/* Connected Repos Display */}
            {allRepos.length > 0 && (
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">
                  Connected:
                </span>
                {allRepos.slice(0, 5).map((repo) => (
                  <Badge key={repo.id} variant="secondary" className="gap-1">
                    <Folder className="h-3 w-3" />
                    {repo.full_name}
                  </Badge>
                ))}
                {allRepos.length > 5 && (
                  <Badge variant="outline">+{allRepos.length - 5} more</Badge>
                )}
              </div>
            )}

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
