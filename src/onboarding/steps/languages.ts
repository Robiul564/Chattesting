import { StepDefinition } from "../types";

export const languagesStep: StepDefinition = {
  prompt: () => "Which languages do you serve customers in? Comma-separated.",
  validate: (message) => {
    if (!message.text) {
      return { valid: false, error: "Please send at least one language." };
    }
    const values = message.text
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (values.length === 0) {
      return { valid: false, error: "Please send at least one language." };
    }
    return { valid: true, value: values };
  },
};
