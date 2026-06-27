import { StepDefinition } from "../types";

export const workingHoursStep: StepDefinition = {
  prompt: () =>
    "Share your working hours format, e.g. Mon-Fri 09:00-18:00, Sat 10:00-14:00.",
  validate: (message) => {
    if (!message.text) {
      return { valid: false, error: "Please provide working hours." };
    }
    return { valid: true, value: message.text };
  },
  quickReplies: () => ["24/7", "Weekdays only", "Custom schedule"],
};
