import { prisma } from "../lib/prisma";

export async function retrieveKnowledgeSnippets(
  tenantId: string,
  _query: string,
  limit = 5,
): Promise<string[]> {
  const rows = await prisma.vectorChunk.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((row) => row.content);
}
