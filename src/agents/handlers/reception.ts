import { AgentHandlerInput, AgentHandlerOutput } from "./types";

export async function handleReception(
  input: AgentHandlerInput,
): Promise<AgentHandlerOutput> {
  return {
    reply: `Thanks for reaching out. I can help with information, support, or booking. How can we help today?`,
  };
}
