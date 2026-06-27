import { StepDefinition } from "../types";

const options = ["Owner only", "Medium", "Enterprise"];

export const teamSizeSelectionStep: StepDefinition = {
  prompt: () => "How large is your team? Owner only, Medium, or Enterprise",
  validate: (message) => {
    const raw = message.text?.trim();
    if (!raw || !options.includes(raw)) {
      return {
        valid: false,
        error: "Please choose Owner only, Medium, or Enterprise.",
      };
    }
    return { valid: true, value: raw };
  },
  quickReplies: () => options,
};
