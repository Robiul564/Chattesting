import { knowledgeProcessorWorker } from "./knowledge-processor";
import { ensureWeeklySchedules, weeklyReportWorker } from "./weekly-report-generator";

export async function startWorkers() {
  await ensureWeeklySchedules();
  knowledgeProcessorWorker.on("failed", (job, error) => {
    console.error("knowledge-processor failed", job?.id, error);
  });
  weeklyReportWorker.on("failed", (job, error) => {
    console.error("weekly-report-generator failed", job?.id, error);
  });
}
