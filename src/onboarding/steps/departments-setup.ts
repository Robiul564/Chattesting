import { StepDefinition } from "../types";

export const departmentsSetupStep: StepDefinition = {
  prompt: () =>
    "Send department names separated by commas. Example: Sales, Support, Booking",
  validate: (message) => {
    if (!message.text) {
      return { valid: false, error: "Please send at least one department." };
    }
    const departments = message.text
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (departments.length === 0) {
      return { valid: false, error: "Please send at least one department." };
    }
    return { valid: true, value: departments };
  },
};
