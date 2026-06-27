import { retrieveKnowledgeSnippets } from "../knowledge-retriever";
import { AgentHandlerInput, AgentHandlerOutput } from "./types";

export async function handleSupport(
  input: AgentHandlerInput,
): Promise<AgentHandlerOutput> {
  const snippets = await retrieveKnowledgeSnippets(input.tenantId, input.message, 3);
  if (snippets.length === 0) {
    return {
      reply:
        "I could not find a confident answer in your business knowledge. Please say 'human' to connect with staff.",
    };
  }
  return {
    reply: `From our knowledge base: ${snippets[0]}`,
  };
}
