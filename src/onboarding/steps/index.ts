import { OnboardingStep } from "@prisma/client";
import { businessCategoryStep } from "./business-category";
import { businessDescriptionStep } from "./business-description";
import { businessNameStep } from "./business-name";
import { departmentsSetupStep } from "./departments-setup";
import { dynamicBusinessQuestionsStep } from "./dynamic-business-questions";
import { knowledgeCollectionStep } from "./knowledge-collection";
import { languagesStep } from "./languages";
import { locationStep } from "./location";
import { operationsModelStep } from "./operations-model";
import { reviewAndConfirmStep } from "./review-and-confirm";
import { servicesSetupStep } from "./services-setup";
import { staffSetupStep } from "./staff-setup";
import { teamSizeSelectionStep } from "./team-size-selection";
import { timezoneStep } from "./timezone";
import { websiteStep } from "./website";
import { workingHoursStep } from "./working-hours";
import { StepDefinition } from "../types";

export const onboardingStepHandlers: Record<OnboardingStep, StepDefinition> = {
  BUSINESS_NAME: businessNameStep,
  BUSINESS_CATEGORY: businessCategoryStep,
  WEBSITE: websiteStep,
  BUSINESS_DESCRIPTION: businessDescriptionStep,
  LOCATION: locationStep,
  TIMEZONE: timezoneStep,
  WORKING_HOURS: workingHoursStep,
  LANGUAGES: languagesStep,
  OPERATIONS_MODEL: operationsModelStep,
  DYNAMIC_BUSINESS_QUESTIONS: dynamicBusinessQuestionsStep,
  TEAM_SIZE_SELECTION: teamSizeSelectionStep,
  DEPARTMENTS_SETUP: departmentsSetupStep,
  STAFF_SETUP: staffSetupStep,
  SERVICES_SETUP: servicesSetupStep,
  KNOWLEDGE_COLLECTION: knowledgeCollectionStep,
  REVIEW_AND_CONFIRM: reviewAndConfirmStep,
  COMPLETE: {
    prompt: () => "Onboarding already complete.",
    validate: () => ({ valid: true, value: null }),
  },
};
