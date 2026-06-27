import { StepDefinition } from "../types";

export const knowledgeCollectionStep: StepDefinition = {
  prompt: () =>
    "Share knowledge items now: text answers, website URLs, or upload PDF/DOCX files. Send done when finished.",
  validate: (message) => {
    if (message.text?.toLowerCase() === "done") {
      return { valid: true, value: { done: true } };
    }
    if (message.mediaId) {
      return {
        valid: true,
        value: {
          done: false,
          mediaId: message.mediaId,
          mediaMimeType: message.mediaMimeType,
          mediaFilename: message.mediaFilename,
        },
      };
    }
    if (message.text) {
      return { valid: true, value: { done: false, text: message.text } };
    }
    return { valid: false, error: "Please send text, a URL, a file, or done." };
  },
};
