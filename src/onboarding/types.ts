import { OnboardingStep } from "@prisma/client";
import { InboundMessage } from "../whatsapp/payload";

export type StepResult = {
  valid: boolean;
  value?: unknown;
  error?: string;
};

export type StepDefinition = {
  prompt: (sessionAnswers: Record<string, any>) => string;
  validate: (message: InboundMessage, sessionAnswers: Record<string, any>) => StepResult;
  quickReplies?: (sessionAnswers: Record<string, any>) => string[];
};

export const STEP_ORDER: OnboardingStep[] = [
  "BUSINESS_NAME",
  "BUSINESS_CATEGORY",
  "WEBSITE",
  "BUSINESS_DESCRIPTION",
  "LOCATION",
  "TIMEZONE",
  "WORKING_HOURS",
  "LANGUAGES",
  "OPERATIONS_MODEL",
  "DYNAMIC_BUSINESS_QUESTIONS",
  "TEAM_SIZE_SELECTION",
  "DEPARTMENTS_SETUP",
  "STAFF_SETUP",
  "SERVICES_SETUP",
  "KNOWLEDGE_COLLECTION",
  "REVIEW_AND_CONFIRM",
  "COMPLETE",
];

export function getNextStep(current: OnboardingStep): OnboardingStep {
  const index = STEP_ORDER.indexOf(current);
  if (index === -1 || index === STEP_ORDER.length - 1) {
    return "COMPLETE";
  }
  return STEP_ORDER[index + 1];
}
