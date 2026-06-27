import { AgentType, MessageDirection, MessageSender, Tenant, WhatsAppAccount } from "@prisma/client";
import { trackEvent } from "../analytics/track-event";
import { prisma } from "../lib/prisma";
import { sendWhatsAppText } from "../lib/whatsapp";
import { InboundMessage } from "../whatsapp/payload";
import { handleBooking } from "./handlers/booking";
import { escalateConversation } from "./handlers/escalation";
import { handleReception } from "./handlers/reception";
import { handleSales } from "./handlers/sales";
import { handleSupport } from "./handlers/support";

function classifyIntent(message: string, allowedAgents: AgentType[]): AgentType {
  const text = message.toLowerCase();
  if ((text.includes("book") || text.includes("appointment")) && allowedAgents.includes("BOOKING")) {
    return "BOOKING";
  }
  if ((text.includes("price") || text.includes("quote") || text.includes("budget")) && allowedAgents.includes("SALES")) {
    return "SALES";
  }
  if ((text.includes("problem") || text.includes("support") || text.includes("policy")) && allowedAgents.includes("SUPPORT")) {
    return "SUPPORT";
  }
  return allowedAgents[0] ?? "RECEPTION";
}

export async function handleActiveTenantMessage(params: {
  tenant: Tenant;
  account: WhatsAppAccount;
  inbound: InboundMessage;
}) {
  const { tenant, account, inbound } = params;
  const text = inbound.text ?? "";

  const business = await prisma.business.findUnique({
    where: { tenantId: tenant.id },
  });
  const config = (business?.config as Record<string, any> | undefined) ?? {};
  const allowedAgents = (config.default_agents as AgentType[] | undefined) ?? [
    "RECEPTION",
    "SUPPORT",
  ];

  const conversation =
    (await prisma.conversation.findFirst({
      where: { tenantId: tenant.id, customerPhone: inbound.from },
    })) ??
    (await prisma.conversation.create({
      data: {
        tenantId: tenant.id,
        customerPhone: inbound.from,
        currentAgent: "RECEPTION",
      },
    }));

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: MessageDirection.INBOUND,
      sender: MessageSender.CUSTOMER,
      content: text || "[media]",
      metadata: {
        messageId: inbound.messageId,
        mediaId: inbound.mediaId ?? null,
      },
    },
  });

  if (conversation.createdAt.getTime() === conversation.updatedAt.getTime()) {
    await trackEvent(tenant.id, "conversation_started", {
      conversationId: conversation.id,
    });
  }

  const userWantsHuman =
    /human|agent|person/i.test(text) || /talk to/i.test(text.toLowerCase());
  if (userWantsHuman) {
    await escalateConversation({
      tenantId: tenant.id,
      conversationId: conversation.id,
      phoneNumberId: account.phoneNumberId,
    });
    const reply = "I am escalating this to a human teammate now.";
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        sender: "SYSTEM",
        content: reply,
      },
    });
    await sendWhatsAppText(account.phoneNumberId, inbound.from, reply);
    return;
  }

  const chosen = classifyIntent(text, allowedAgents);
  let reply = "";

  if (chosen === "BOOKING") {
    const out = await handleBooking({
      tenantId: tenant.id,
      conversation,
      message: text,
      businessConfig: config,
    });
    reply = out.reply;
    await trackEvent(tenant.id, "booking_created", { conversationId: conversation.id });
  } else if (chosen === "SALES") {
    const out = await handleSales({
      tenantId: tenant.id,
      conversation,
      message: text,
      businessConfig: config,
    });
    reply = out.reply;
    await trackEvent(tenant.id, "lead_qualified", { conversationId: conversation.id });
  } else if (chosen === "SUPPORT") {
    const out = await handleSupport({
      tenantId: tenant.id,
      conversation,
      message: text,
      businessConfig: config,
    });
    reply = out.reply;

    if (/could not find a confident answer/i.test(reply)) {
      const recentSupportFailures = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          direction: "OUTBOUND",
          content: { contains: "could not find a confident answer", mode: "insensitive" },
        },
      });
      if (recentSupportFailures >= 1) {
        await escalateConversation({
          tenantId: tenant.id,
          conversationId: conversation.id,
          phoneNumberId: account.phoneNumberId,
        });
      }
    }
  } else {
    const out = await handleReception({
      tenantId: tenant.id,
      conversation,
      message: text,
      businessConfig: config,
    });
    reply = out.reply;
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      currentAgent: chosen,
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      sender: "AI_AGENT",
      content: reply,
    },
  });

  await sendWhatsAppText(account.phoneNumberId, inbound.from, reply);
}
