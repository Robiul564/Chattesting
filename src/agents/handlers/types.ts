import { Conversation } from "@prisma/client";

export type AgentHandlerInput = {
  tenantId: string;
  conversation: Conversation;
  message: string;
  businessConfig: Record<string, unknown>;
};

export type AgentHandlerOutput = {
  reply: string;
  conversationStatus?: "AI_HANDLING" | "PENDING_HUMAN" | "HUMAN_HANDLING" | "RESOLVED";
  assignedStaffId?: string | null;
};
