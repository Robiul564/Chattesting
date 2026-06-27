import { prisma } from "../../lib/prisma";
import { AgentHandlerInput, AgentHandlerOutput } from "./types";

export async function handleBooking(
  input: AgentHandlerInput,
): Promise<AgentHandlerOutput> {
  const now = new Date();
  const scheduledAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const service = await prisma.service.findFirst({
    where: { tenantId: input.tenantId, isActive: true },
  });

  if (!service) {
    return { reply: "No services are available for booking yet. Please contact support." };
  }

  await prisma.booking.create({
    data: {
      tenantId: input.tenantId,
      serviceId: service.id,
      conversationId: input.conversation.id,
      customerPhone: input.conversation.customerPhone,
      customerName: input.conversation.customerName,
      scheduledAt,
      status: "PENDING",
    },
  });

  return {
    reply: `Tentative booking created for ${scheduledAt.toISOString()}. We will confirm shortly.`,
  };
}
