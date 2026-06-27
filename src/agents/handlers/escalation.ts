import { Conversation, Staff } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { sendWhatsAppText } from "../../lib/whatsapp";
import { trackEvent } from "../../analytics/track-event";

function summarize(messages: string[]): string {
  if (messages.length === 0) {
    return "Customer requested human support. No conversation details available.";
  }
  return `Customer needs human help. Recent topic: ${messages.slice(-2).join(" / ").slice(0, 180)}.`;
}

function mapDepartment(agentType: string): string {
  if (agentType === "SALES") return "Sales";
  if (agentType === "BOOKING") return "Booking";
  return "Support";
}

async function chooseStaff(tenantId: string, conversation: Conversation): Promise<Staff | null> {
  if (conversation.assignedStaffId) {
    return prisma.staff.findFirst({
      where: {
        tenantId,
        id: conversation.assignedStaffId,
        isActive: true,
      },
    });
  }

  const targetDepartment = mapDepartment(conversation.currentAgent);
  return prisma.staff.findFirst({
    where: {
      tenantId,
      isActive: true,
      department: {
        is: {
          tenantId,
          name: targetDepartment,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function escalateConversation(params: {
  tenantId: string;
  conversationId: string;
  phoneNumberId: string;
}) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      tenantId: params.tenantId,
      id: params.conversationId,
    },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!conversation) {
    return;
  }

  const summary = summarize(conversation.messages.map((message) => message.content).reverse());
  const staff = await chooseStaff(params.tenantId, conversation);

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      status: "PENDING_HUMAN",
      aiSummary: summary,
      assignedStaffId: staff?.id ?? conversation.assignedStaffId,
    },
  });

  if (staff?.phone) {
    await sendWhatsAppText(
      params.phoneNumberId,
      staff.phone,
      `Handoff needed: ${summary} Conversation ID: ${conversation.id}`,
    );
  }

  await trackEvent(params.tenantId, "human_takeover", {
    conversationId: conversation.id,
    assignedStaffId: staff?.id ?? null,
  });
}
