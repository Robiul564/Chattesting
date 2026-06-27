import { StepDefinition } from "../types";

export const reviewAndConfirmStep: StepDefinition = {
  prompt: () => "Review complete. Reply CONFIRM to finish onboarding.",
  validate: (message) => {
    if (message.text?.trim().toUpperCase() !== "CONFIRM") {
      return { valid: false, error: "Please reply with CONFIRM to complete setup." };
    }
    return { valid: true, value: "CONFIRM" };
  },
};
