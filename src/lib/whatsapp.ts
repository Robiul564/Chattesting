import crypto from "crypto";
import { env } from "./env";

type QuickReply = { id: string; title: string };

export function verifyMetaSignature(rawBody: Buffer, signature?: string): boolean {
  if (!env.META_APP_SECRET || !signature) {
    return true;
  }
  const expected = crypto
    .createHmac("sha256", env.META_APP_SECRET)
    .update(rawBody)
    .digest("hex");
  const normalized = signature.replace("sha256=", "");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalized));
}

export async function sendWhatsAppText(
  phoneNumberId: string,
  to: string,
  text: string,
  quickReplies?: QuickReply[],
): Promise<void> {
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const interactive =
    quickReplies && quickReplies.length > 0
      ? {
          type: "button",
          body: { text },
          action: {
            buttons: quickReplies.slice(0, 3).map((reply) => ({
              type: "reply",
              reply: { id: reply.id, title: reply.title.slice(0, 20) },
            })),
          },
        }
      : undefined;

  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(
      interactive
        ? {
            messaging_product: "whatsapp",
            to,
            type: "interactive",
            interactive,
          }
        : {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: text },
          },
    ),
  });
}
