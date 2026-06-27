import { StepDefinition } from "../types";
import { getOnboardingQuestions } from "../../business-config/resolver";

export const dynamicBusinessQuestionsStep: StepDefinition = {
  prompt: (answers) => {
    const businessType = String(answers.OPERATIONS_MODEL ?? "custom");
    const questions = getOnboardingQuestions(businessType);
    const index = Number(answers.__dynamicQuestionIndex ?? 0);
    if (!questions[index]) {
      return "Dynamic setup complete.";
    }
    return questions[index].prompt;
  },
  validate: (message) => {
    if (!message.text) {
      return { valid: false, error: "Please answer this question." };
    }
    return { valid: true, value: message.text };
  },
  quickReplies: (answers) => {
    const businessType = String(answers.OPERATIONS_MODEL ?? "custom");
    const questions = getOnboardingQuestions(businessType);
    const index = Number(answers.__dynamicQuestionIndex ?? 0);
    return questions[index]?.quick_replies ?? [];
  },
};
