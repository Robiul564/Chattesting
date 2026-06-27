import { Job, Worker } from "bullmq";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";

type Payload = {
  tenantId: string;
  knowledgeItemId: string;
};

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
    i += Math.max(1, chunkSize - overlap);
  }
  return chunks;
}

function syntheticEmbed(_text: string): number[] {
  return Array.from({ length: 8 }).map((_, i) => i * 0.01);
}

async function processKnowledge(job: Job<Payload>) {
  const { tenantId, knowledgeItemId } = job.data;
  const item = await prisma.knowledgeItem.findFirst({
    where: { tenantId, id: knowledgeItemId },
  });
  if (!item) return;

  await prisma.knowledgeItem.update({
    where: { id: item.id },
    data: { status: "PROCESSING" },
  });

  try {
    const sourceText = item.content || item.sourceUrl || "";
    const chunks = chunkText(sourceText, 120, 20);

    for (const content of chunks) {
      const _embedding = syntheticEmbed(content);
      await prisma.vectorChunk.create({
        data: {
          tenantId,
          knowledgeItemId: item.id,
          content,
        },
      });
    }

    await prisma.knowledgeItem.update({
      where: { id: item.id },
      data: { status: "INDEXED" },
    });
  } catch (error: any) {
    await prisma.knowledgeItem.update({
      where: { id: item.id },
      data: { status: "FAILED" },
    });
    throw error;
  }
}

export const knowledgeProcessorWorker = new Worker<Payload>(
  "knowledge-processor",
  processKnowledge,
  { connection: redis },
);
