import { StepDefinition } from "../types";

export const businessCategoryStep: StepDefinition = {
  prompt: () => "What category best describes your business?",
  validate: (message) => {
    if (!message.text) {
      return { valid: false, error: "Please enter your business category." };
    }
    return { valid: true, value: message.text };
  },
};
