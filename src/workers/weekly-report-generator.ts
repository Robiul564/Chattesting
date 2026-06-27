import { Job, Worker } from "bullmq";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { reportQueue } from "../lib/queue";
import { sendWhatsAppText } from "../lib/whatsapp";

type Payload = { tenantId: string };

function startOfWindow(): Date {
  const now = new Date();
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}

function narrative(metrics: Record<string, number>): string {
  return `Weekly report: ${metrics.conversations} conversations, ${metrics.leadsGenerated} leads, ${metrics.bookingsCreated} bookings, conversion ${metrics.conversionRate.toFixed(1)}%.`;
}

async function generateWeekly(job: Job<Payload>) {
  const { tenantId } = job.data;
  const periodStart = startOfWindow();
  const periodEnd = new Date();

  const [conversations, leads, bookings, takeovers] = await Promise.all([
    prisma.conversation.count({ where: { tenantId, createdAt: { gte: periodStart } } }),
    prisma.analyticsEvent.count({
      where: { tenantId, eventType: "lead_qualified", createdAt: { gte: periodStart } },
    }),
    prisma.booking.count({ where: { tenantId, createdAt: { gte: periodStart } } }),
    prisma.analyticsEvent.count({
      where: { tenantId, eventType: "human_takeover", createdAt: { gte: periodStart } },
    }),
  ]);

  const metrics = {
    conversations,
    leadsGenerated: leads,
    bookingsCreated: bookings,
    conversionRate: leads > 0 ? (bookings / leads) * 100 : 0,
    humanTakeovers: takeovers,
    csat: 0,
    revenue: 0,
  };

  await prisma.weeklyReport.create({
    data: {
      tenantId,
      periodStart,
      periodEnd,
      metrics,
      aiNarrative: narrative(metrics),
    },
  });

  const account = await prisma.whatsAppAccount.findFirst({
    where: { tenantId },
  });
  const owner = await prisma.staff.findFirst({
    where: { tenantId, role: "Owner" },
  });
  if (account && owner?.phone) {
    await sendWhatsAppText(account.phoneNumberId, owner.phone, narrative(metrics));
  }
}

export const weeklyReportWorker = new Worker<Payload>(
  "weekly-report-generator",
  generateWeekly,
  { connection: redis },
);

export async function ensureWeeklySchedules() {
  const tenants = await prisma.tenant.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  for (const tenant of tenants) {
    await reportQueue.add(
      "weekly-per-tenant",
      { tenantId: tenant.id },
      {
        repeat: { pattern: "0 9 * * 1" },
        jobId: `weekly-${tenant.id}`,
      },
    );
  }
}
