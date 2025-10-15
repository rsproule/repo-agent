export type AgentStatus = {
  status: "thinking" | "completing" | "complete";
  agent?: string;
  thought?: string;
};
