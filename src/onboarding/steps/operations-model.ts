import { StepDefinition } from "../types";

const options = ["clinic", "agency", "restaurant", "custom"];

export const operationsModelStep: StepDefinition = {
  prompt: () =>
    "What business type best matches your operations? clinic, agency, restaurant, or custom",
  validate: (message) => {
    const raw = message.text?.trim().toLowerCase();
    if (!raw) {
      return { valid: false, error: "Please pick one business type." };
    }
    if (!options.includes(raw)) {
      return {
        valid: false,
        error: "Use one of: clinic, agency, restaurant, custom.",
      };
    }
    return { valid: true, value: raw };
  },
  quickReplies: () => ["clinic", "agency", "restaurant"],
};
