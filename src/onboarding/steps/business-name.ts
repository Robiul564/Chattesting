import { StepDefinition } from "../types";

export const businessNameStep: StepDefinition = {
  prompt: () => "What is your business name?",
  validate: (message) => {
    if (!message.text || message.text.length < 2) {
      return { valid: false, error: "Please share a valid business name." };
    }
    return { valid: true, value: message.text };
  },
};
