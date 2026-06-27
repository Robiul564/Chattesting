import { AgentHandlerInput, AgentHandlerOutput } from "./types";

export async function handleSales(input: AgentHandlerInput): Promise<AgentHandlerOutput> {
  return {
    reply: `Great question. Please share your goals, budget, and timeline so our sales team can prepare the best option.`,
  };
}
