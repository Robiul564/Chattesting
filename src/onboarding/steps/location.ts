import { StepDefinition } from "../types";

export const locationStep: StepDefinition = {
  prompt: () => "What is your business location or service area?",
  validate: (message) => {
    if (!message.text) {
      return { valid: false, error: "Please share your location." };
    }
    return { valid: true, value: message.text };
  },
};
