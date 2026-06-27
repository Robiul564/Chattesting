import { StepDefinition } from "../types";

export const servicesSetupStep: StepDefinition = {
  prompt: (answers) => {
    const customPrompt = answers.__defaultServicesPrompt;
    if (typeof customPrompt === "string" && customPrompt.length > 0) {
      return `${customPrompt} Send done when finished.`;
    }
    return "Add services one per message in this format: name | price(optional) | duration mins(optional). Send done when finished.";
  },
  validate: (message) => {
    const raw = message.text?.trim();
    if (!raw) {
      return { valid: false, error: "Please send a service line or done." };
    }
    if (raw.toLowerCase() === "done") {
      return { valid: true, value: { done: true } };
    }
    const parts = raw.split("|").map((part) => part.trim());
    if (parts.length < 1 || !parts[0]) {
      return { valid: false, error: "Service name is required." };
    }
    return {
      valid: true,
      value: {
        done: false,
        name: parts[0],
        price: parts[1] || null,
        durationMins: parts[2] ? Number(parts[2]) : null,
      },
    };
  },
};
