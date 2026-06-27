import fs from "fs";
import path from "path";

export type BusinessQuestion = {
  key: string;
  prompt: string;
  type: "boolean" | "number" | "text_list" | "single_select" | string;
  quick_replies?: string[];
  example?: string;
};

export type BusinessTypeConfig = {
  business_type: string;
  label: string;
  config: Record<string, unknown>;
  onboarding_questions: BusinessQuestion[];
  default_services_prompt?: string;
  workflow_templates?: Array<{ type: string; steps: string[] }>;
  default_agents?: string[];
};

const BUSINESS_TYPES_DIR = path.resolve(process.cwd(), "config/business-types");

export function loadBusinessTypeConfig(
  businessType: string
): { config: BusinessTypeConfig; isFallback: boolean } {
  const filePath = path.join(BUSINESS_TYPES_DIR, `${businessType}.json`);
  if (!fs.existsSync(filePath)) {
    return {
      isFallback: true,
      config: {
        business_type: "custom",
        label: "Custom Business",
        config: {
          requires_booking: false,
          staff_assignment: false,
          multi_department: false,
          payment_required: false,
          lead_generation: false,
          quotation_required: false,
        },
        onboarding_questions: [],
        default_services_prompt:
          "List your services or products one by one, then send done.",
        workflow_templates: [],
        default_agents: ["RECEPTION", "SUPPORT", "ESCALATION"],
      },
    };
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return { isFallback: false, config: JSON.parse(raw) as BusinessTypeConfig };
}

export function getOnboardingQuestions(businessType: string): BusinessQuestion[] {
  return loadBusinessTypeConfig(businessType).config.onboarding_questions ?? [];
}

export function buildBusinessProfile(
  businessType: string,
  answers: Record<string, unknown>,
): {
  businessType: string;
  config: Record<string, unknown>;
  needsManualReview: boolean;
} {
  const loaded = loadBusinessTypeConfig(businessType);
  return {
    businessType: loaded.config.business_type,
    needsManualReview: loaded.isFallback,
    config: {
      ...loaded.config.config,
      customizations: answers,
      default_agents: loaded.config.default_agents ?? [],
    },
  };
}
