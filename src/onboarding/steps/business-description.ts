import { StepDefinition } from "../types";

export const businessDescriptionStep: StepDefinition = {
  prompt: () => "Briefly describe your business in 1-3 lines.",
  validate: (message) => {
    if (!message.text) {
      return { valid: false, error: "Please send a short business description." };
    }
    return { valid: true, value: message.text };
  },
};
