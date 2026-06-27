import { StepDefinition } from "../types";

export const staffSetupStep: StepDefinition = {
  prompt: (answers) => {
    if (!answers.__staffDraft) {
      return "Add staff as: name | role | phone | email(optional) | department. Send 'done' when finished.";
    }
    return "Continue staff setup or send done.";
  },
  validate: (message) => {
    const raw = message.text?.trim();
    if (!raw) {
      return { valid: false, error: "Please send staff details or done." };
    }
    if (raw.toLowerCase() === "done") {
      return { valid: true, value: { done: true } };
    }
    const parts = raw.split("|").map((part) => part.trim());
    if (parts.length < 3) {
      return {
        valid: false,
        error:
          "Use format: name | role | phone | email(optional) | department(optional)",
      };
    }
    return {
      valid: true,
      value: {
        done: false,
        name: parts[0],
        role: parts[1],
        phone: parts[2],
        email: parts[3] || null,
        department: parts[4] || null,
      },
    };
  },
};
