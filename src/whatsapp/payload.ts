export type InboundMessage = {
  messageId: string;
  from: string;
  text?: string;
  mediaId?: string;
  mediaMimeType?: string;
  mediaFilename?: string;
};

export function parseInboundMessage(payload: any): InboundMessage | null {
  const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message?.id || !message?.from) {
    return null;
  }

  const text =
    message?.text?.body ??
    message?.button?.text ??
    message?.interactive?.button_reply?.title ??
    message?.interactive?.list_reply?.title;

  const documentMedia = message?.document;

  return {
    messageId: String(message.id),
    from: String(message.from),
    text: typeof text === "string" ? text.trim() : undefined,
    mediaId: documentMedia?.id ? String(documentMedia.id) : undefined,
    mediaMimeType: documentMedia?.mime_type
      ? String(documentMedia.mime_type)
      : undefined,
    mediaFilename: documentMedia?.filename
      ? String(documentMedia.filename)
      : undefined,
  };
}
