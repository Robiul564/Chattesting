import { Router } from "express";
import { prisma } from "../lib/prisma";
import { trackEvent } from "../analytics/track-event";
import { sendWhatsAppText } from "../lib/whatsapp";

export const conversationRouter = Router();

conversationRouter.post("/:id/takeover", async function (req, res) {
  const conversationId = req.params.id;
  const tenantId = String(req.body?.tenantId ?? "");
  const staffId = req.body?.staffId ? String(req.body.staffId) : null;

  if (!tenantId) {
    return res.status(400).json({ error: "tenantId is required" });
  }

  const updated = await prisma.conversation.updateMany({
    where: { id: conversationId, tenantId },
    data: {
      status: "HUMAN_HANDLING",
      assignedStaffId: staffId,
    },
  });

  if (updated.count === 0) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  await trackEvent(tenantId, "human_takeover", { conversationId, staffId });
  return res.json({ ok: true });
});

conversationRouter.post("/:id/resolve", async function (req, res) {
  const conversationId = req.params.id;
  const tenantId = String(req.body?.tenantId ?? "");

  if (!tenantId) {
    return res.status(400).json({ error: "tenantId is required" });
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
  });
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { status: "RESOLVED" },
  });

  const alreadyPrompted = await prisma.analyticsEvent.count({
    where: {
      tenantId,
      eventType: "csat_prompt_sent",
      payload: { path: ["conversationId"], equals: conversationId },
    },
  });

  if (alreadyPrompted === 0) {
    const account = await prisma.whatsAppAccount.findFirst({ where: { tenantId } });
    if (account) {
      await sendWhatsAppText(
        account.phoneNumberId,
        conversation.customerPhone,
        "How would you rate your experience from 1 to 5?",
        [
          { id: "1", title: "1" },
          { id: "2", title: "2" },
          { id: "3", title: "3" },
        ],
      );
      await trackEvent(tenantId, "csat_prompt_sent", { conversationId });
    }
  }

  await trackEvent(tenantId, "conversation_resolved", { conversationId });
  return res.json({ ok: true });
});

