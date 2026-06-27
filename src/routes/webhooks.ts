import { Router } from "express";
import { handleActiveTenantMessage } from "../agents/orchestrator";
import { prisma } from "../lib/prisma";
import { verifyMetaSignature } from "../lib/whatsapp";
import { handleOnboardingMessage } from "../onboarding/engine";
import { parseInboundMessage } from "../whatsapp/payload";

export const webhookRouter = Router();

webhookRouter.post("/whatsapp/:phoneNumberId", async function (req, res) {
  const phoneNumberId = req.params.phoneNumberId;
  const rawBody = (req as any).rawBody as Buffer;
  const signature = req.header("x-hub-signature-256");
  if (!rawBody) { return res.status(401).send("Invalid signature"); }
  if (verifyMetaSignature(rawBody, signature) === false) { return res.status(401).send("Invalid signature"); }
  const inbound = parseInboundMessage(req.body);
  if (!inbound) { return res.status(200).send("ignored"); }
  const account = await prisma.whatsAppAccount.findUnique({ where: { phoneNumberId } });
  if (!account) { return res.status(404).send("Unknown phone number"); }
  const tenant = await prisma.tenant.findUnique({ where: { id: account.tenantId } });
  if (!tenant) { return res.status(404).send("Unknown tenant"); }
  if (tenant.status === "ONBOARDING") { await handleOnboardingMessage({ tenant, account, inbound }); }
  if (tenant.status === "ACTIVE") { await handleActiveTenantMessage({ tenant, account, inbound }); }
  return res.status(200).send("ok");
});

 
webhookRouter.get('/whatsapp/:phoneNumberId', async function (req, res) { 
  const phoneNumberId = req.params.phoneNumberId; 
  const mode = String(req.query['hub.mode'] ?? ''); 
  const challenge = String(req.query['hub.challenge'] ?? ''); 
  const token = String(req.query['hub.verify_token'] ?? ''); 
  const account = await prisma.whatsAppAccount.findUnique({ where: { phoneNumberId } }); 
  if (!account) { return res.status(404).send('unknown'); } 
  if (mode === 'subscribe') { 
    if (token === account.webhookVerifyToken) { return res.status(200).send(challenge); } 
  } 
  return res.status(403).send('forbidden'); 
});
