import { Queue } from "bullmq";
import { redis } from "./redis";

export const knowledgeQueue = new Queue("knowledge-processor", {
  connection: redis,
});

export const reportQueue = new Queue("weekly-report-generator", {
  connection: redis,
});
