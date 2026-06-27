import { StepDefinition } from "../types";

export const timezoneStep: StepDefinition = {
  prompt: () => "Which timezone should we use? Example: Asia/Dhaka",
  validate: (message) => {
    if (!message.text) {
      return { valid: false, error: "Please provide a timezone." };
    }
    return { valid: true, value: message.text };
  },
};
