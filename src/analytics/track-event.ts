import { prisma } from "../lib/prisma";

export async function trackEvent(
  tenantId: string,
  eventType: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  await prisma.analyticsEvent.create({
    data: {
      tenantId,
      eventType,
      payload: payload ?? {},
    },
  });
}
