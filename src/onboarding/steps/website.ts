import { StepDefinition } from "../types";

export const websiteStep: StepDefinition = {
  prompt: () => "What is your website URL? Reply 'none' if you do not have one.",
  validate: (message) => {
    const raw = message.text?.trim();
    if (!raw) {
      return { valid: false, error: "Please provide a website or type none." };
    }
    if (raw.toLowerCase() === "none") {
      return { valid: true, value: null };
    }
    try {
      new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      return { valid: true, value: raw };
    } catch {
      return { valid: false, error: "Please send a valid URL." };
    }
  },
};
