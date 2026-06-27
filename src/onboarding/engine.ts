import {
  KnowledgeType,
  OnboardingSession,
  OnboardingStep,
  Prisma,
  Tenant,
  WhatsAppAccount,
} from "@prisma/client";
import { buildBusinessProfile, getOnboardingQuestions, loadBusinessTypeConfig } from "../business-config/resolver";
import { prisma } from "../lib/prisma";
import { knowledgeQueue } from "../lib/queue";
import { sendWhatsAppText } from "../lib/whatsapp";
import { InboundMessage } from "../whatsapp/payload";
import { trackEvent } from "../analytics/track-event";
import { generateTenantWorkflows } from "../workflows/generator";
import { onboardingStepHandlers } from "./steps";
import { getNextStep } from "./types";

type Answers = Record<string, any>;

function asAnswers(session: OnboardingSession): Answers {
  return (session.answers as Answers) ?? {};
}

function getProcessedIds(answers: Answers): string[] {
  return Array.isArray(answers.__processedMessageIds)
    ? answers.__processedMessageIds
    : [];
}

async function saveSession(
  sessionId: string,
  currentStep: OnboardingStep,
  answers: Answers,
  completedAt: Date | null = null,
) {
  return prisma.onboardingSession.update({
    where: { id: sessionId },
    data: { currentStep, answers, completedAt },
  });
}

async function promptCurrentStep(
  account: WhatsAppAccount,
  session: OnboardingSession,
  to: string,
) {
  const answers = asAnswers(session);
  const handler = onboardingStepHandlers[session.currentStep];
  const prompt = handler.prompt(answers);
  const quickReplies = handler.quickReplies?.(answers)?.map((value) => ({
    id: value,
    title: value,
  }));
  await sendWhatsAppText(account.phoneNumberId, to, prompt, quickReplies);
}

function inferKnowledgeTypeFromText(text: string): KnowledgeType {
  const lower = text.toLowerCase();
  if (lower.startsWith("about")) return "ABOUT_US";
  if (lower.startsWith("mission")) return "MISSION";
  if (lower.startsWith("policy")) return "POLICY";
  if (lower.startsWith("faq")) return "FAQ";
  return "FAQ";
}

export async function handleOnboardingMessage(params: {
  tenant: Tenant;
  account: WhatsAppAccount;
  inbound: InboundMessage;
}) {
  const { tenant, account, inbound } = params;
  let session = await prisma.onboardingSession.findUnique({
    where: { tenantId: tenant.id },
  });

  if (!session) {
    session = await prisma.onboardingSession.create({
      data: {
        tenantId: tenant.id,
        currentStep: "BUSINESS_NAME",
        answers: {},
      },
    });
    await promptCurrentStep(account, session, inbound.from);
    return;
  }

  const answers = asAnswers(session);
  const processed = getProcessedIds(answers);
  if (processed.includes(inbound.messageId)) {
    await promptCurrentStep(account, session, inbound.from);
    return;
  }

  if (session.currentStep === "SERVICES_SETUP" && answers.__serviceAssignPendingId) {
    const staffAnswer = inbound.text?.trim() ?? "";
    if (staffAnswer && staffAnswer.toLowerCase() !== "skip") {
      const names = staffAnswer
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const staff = await prisma.staff.findMany({
        where: { tenantId: tenant.id, name: { in: names } },
      });
      if (staff.length > 0) {
        await prisma.service.update({
          where: { id: String(answers.__serviceAssignPendingId) },
          data: {
            assignedStaff: {
              connect: staff.map((s) => ({ id: s.id })),
            },
          },
        });
      }
    }
    delete answers.__serviceAssignPendingId;
    answers.__processedMessageIds = [...processed, inbound.messageId].slice(-200);
    session = await saveSession(session.id, session.currentStep, answers);
    await sendWhatsAppText(
      account.phoneNumberId,
      inbound.from,
      "Saved. Add another service or send done.",
    );
    return;
  }

  const handler = onboardingStepHandlers[session.currentStep];
  const validated = handler.validate(inbound, answers);
  if (!validated.valid) {
    await sendWhatsAppText(
      account.phoneNumberId,
      inbound.from,
      validated.error ?? "Please try again.",
    );
    await promptCurrentStep(account, session, inbound.from);
    return;
  }

  const stepKey = session.currentStep;
  answers[stepKey] = validated.value;

  if (stepKey === "OPERATIONS_MODEL") {
    const cfg = loadBusinessTypeConfig(String(validated.value));
    answers.__defaultServicesPrompt = cfg.config.default_services_prompt;
  }

  let nextStep = getNextStep(stepKey);

  if (stepKey === "DYNAMIC_BUSINESS_QUESTIONS") {
    const businessType = String(answers.OPERATIONS_MODEL ?? "custom");
    const questions = getOnboardingQuestions(businessType);
    const index = Number(answers.__dynamicQuestionIndex ?? 0);
    const currentQ = questions[index];
    answers.__dynamicAnswers = answers.__dynamicAnswers ?? {};
    if (currentQ) {
      answers.__dynamicAnswers[currentQ.key] = validated.value;
    }
    const nextIndex = index + 1;
    if (questions[nextIndex]) {
      answers.__dynamicQuestionIndex = nextIndex;
      answers.__processedMessageIds = [...processed, inbound.messageId].slice(-200);
      session = await saveSession(session.id, "DYNAMIC_BUSINESS_QUESTIONS", answers);
      await promptCurrentStep(account, session, inbound.from);
      return;
    }

    const profile = buildBusinessProfile(businessType, answers.__dynamicAnswers ?? {});
    await prisma.business.upsert({
      where: { tenantId: tenant.id },
      update: {
        name: String(answers.BUSINESS_NAME ?? tenant.name),
        category: String(answers.BUSINESS_CATEGORY ?? "General"),
        businessType: profile.businessType,
        website:
          typeof answers.WEBSITE === "string" ? String(answers.WEBSITE) : null,
        description:
          typeof answers.BUSINESS_DESCRIPTION === "string"
            ? String(answers.BUSINESS_DESCRIPTION)
            : null,
        location: typeof answers.LOCATION === "string" ? String(answers.LOCATION) : null,
        timezone: String(answers.TIMEZONE ?? "UTC"),
        workingHours: answers.WORKING_HOURS ?? "Mon-Fri 09:00-18:00",
        languages: Array.isArray(answers.LANGUAGES) ? answers.LANGUAGES : ["en"],
        config: profile.config as Prisma.InputJsonValue,
      },
      create: {
        tenantId: tenant.id,
        name: String(answers.BUSINESS_NAME ?? tenant.name),
        category: String(answers.BUSINESS_CATEGORY ?? "General"),
        businessType: profile.businessType,
        website:
          typeof answers.WEBSITE === "string" ? String(answers.WEBSITE) : null,
        description:
          typeof answers.BUSINESS_DESCRIPTION === "string"
            ? String(answers.BUSINESS_DESCRIPTION)
            : null,
        location: typeof answers.LOCATION === "string" ? String(answers.LOCATION) : null,
        timezone: String(answers.TIMEZONE ?? "UTC"),
        workingHours: answers.WORKING_HOURS ?? "Mon-Fri 09:00-18:00",
        languages: Array.isArray(answers.LANGUAGES) ? answers.LANGUAGES : ["en"],
        config: profile.config as Prisma.InputJsonValue,
      },
    });

    if (profile.needsManualReview) {
      await trackEvent(tenant.id, "custom_business_needs_review", {
        selectedBusinessType: businessType,
      });
    }
  }

  if (stepKey === "TEAM_SIZE_SELECTION") {
    const business = await prisma.business.findUnique({
      where: { tenantId: tenant.id },
    });
    const config = (business?.config as Record<string, any> | undefined) ?? {};
    const forceOwnerOnly = config.multi_department === false;
    const ownerOnly = forceOwnerOnly || validated.value === "Owner only";
    if (ownerOnly) {
      await prisma.staff.create({
        data: {
          tenantId: tenant.id,
          name: "Owner",
          role: "Owner",
          phone: account.displayPhoneNumber,
          email: null,
        },
      });
      nextStep = "SERVICES_SETUP";
    }
  }

  if (stepKey === "DEPARTMENTS_SETUP") {
    const departmentNames = (validated.value as string[]) ?? [];
    for (const name of departmentNames) {
      await prisma.department.create({
        data: { tenantId: tenant.id, name },
      });
    }
  }

  if (stepKey === "STAFF_SETUP") {
    const payload = validated.value as Record<string, any>;
    if (payload.done === true) {
      nextStep = getNextStep(stepKey);
    } else {
      let departmentId: string | null = null;
      if (payload.department) {
        const department = await prisma.department.findFirst({
          where: { tenantId: tenant.id, name: String(payload.department) },
        });
        departmentId = department?.id ?? null;
      }
      await prisma.staff.create({
        data: {
          tenantId: tenant.id,
          name: String(payload.name),
          role: String(payload.role),
          phone: String(payload.phone),
          email: payload.email ? String(payload.email) : null,
          departmentId,
        },
      });
      nextStep = "STAFF_SETUP";
      answers.__processedMessageIds = [...processed, inbound.messageId].slice(-200);
      session = await saveSession(session.id, nextStep, answers);
      await sendWhatsAppText(
        account.phoneNumberId,
        inbound.from,
        "Staff member added. Send next one or done.",
      );
      return;
    }
  }

  if (stepKey === "SERVICES_SETUP") {
    const payload = validated.value as Record<string, any>;
    if (payload.done === true) {
      nextStep = getNextStep(stepKey);
    } else {
      const service = await prisma.service.create({
        data: {
          tenantId: tenant.id,
          name: String(payload.name),
          price: payload.price ? Number(payload.price) : null,
          durationMins:
            typeof payload.durationMins === "number" && !Number.isNaN(payload.durationMins)
              ? payload.durationMins
              : null,
        },
      });
      const business = await prisma.business.findUnique({
        where: { tenantId: tenant.id },
      });
      const config = (business?.config as Record<string, any> | undefined) ?? {};
      if (config.staff_assignment === true) {
        answers.__serviceAssignPendingId = service.id;
        answers.__processedMessageIds = [...processed, inbound.messageId].slice(-200);
        session = await saveSession(session.id, "SERVICES_SETUP", answers);
        await sendWhatsAppText(
          account.phoneNumberId,
          inbound.from,
          "Which staff handle this service? Send comma-separated names, or type skip.",
        );
        return;
      }
      nextStep = "SERVICES_SETUP";
      answers.__processedMessageIds = [...processed, inbound.messageId].slice(-200);
      session = await saveSession(session.id, nextStep, answers);
      await sendWhatsAppText(
        account.phoneNumberId,
        inbound.from,
        "Service added. Send another service or done.",
      );
      return;
    }
  }

  if (stepKey === "KNOWLEDGE_COLLECTION") {
    const payload = validated.value as Record<string, any>;
    if (payload.done === true) {
      nextStep = getNextStep(stepKey);
    } else if (payload.mediaId) {
      const mime = String(payload.mediaMimeType ?? "").toLowerCase();
      const type: KnowledgeType = mime.includes("pdf")
        ? "DOCUMENT_PDF"
        : "DOCUMENT_DOCX";
      const item = await prisma.knowledgeItem.create({
        data: {
          tenantId: tenant.id,
          type,
          title: payload.mediaFilename ?? "Uploaded Document",
          sourceUrl: `media://${payload.mediaId}`,
          status: "PENDING",
        },
      });
      await knowledgeQueue.add("process-knowledge", {
        tenantId: tenant.id,
        knowledgeItemId: item.id,
      });
      nextStep = "KNOWLEDGE_COLLECTION";
      answers.__processedMessageIds = [...processed, inbound.messageId].slice(-200);
      session = await saveSession(session.id, nextStep, answers);
      await sendWhatsAppText(
        account.phoneNumberId,
        inbound.from,
        "Document saved for indexing. Send more or done.",
      );
      return;
    } else if (payload.text) {
      const text = String(payload.text);
      const isUrl = /^https?:\/\//i.test(text);
      const item = await prisma.knowledgeItem.create({
        data: {
          tenantId: tenant.id,
          type: isUrl ? "WEBSITE_URL" : inferKnowledgeTypeFromText(text),
          title: isUrl ? "Website URL" : text.slice(0, 60),
          content: isUrl ? null : text,
          sourceUrl: isUrl ? text : null,
          status: "PENDING",
        },
      });
      await knowledgeQueue.add("process-knowledge", {
        tenantId: tenant.id,
        knowledgeItemId: item.id,
      });
      nextStep = "KNOWLEDGE_COLLECTION";
      answers.__processedMessageIds = [...processed, inbound.messageId].slice(-200);
      session = await saveSession(session.id, nextStep, answers);
      await sendWhatsAppText(
        account.phoneNumberId,
        inbound.from,
        "Knowledge item captured. Send more or done.",
      );
      return;
    }
  }

  if (stepKey === "REVIEW_AND_CONFIRM") {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: "ACTIVE" },
    });

    const business = await prisma.business.findUnique({
      where: { tenantId: tenant.id },
    });
    if (business) {
      await generateTenantWorkflows(tenant.id, business.businessType);
    }
    nextStep = "COMPLETE";
  }

  answers.__processedMessageIds = [...processed, inbound.messageId].slice(-200);
  session = await saveSession(
    session.id,
    nextStep,
    answers,
    nextStep === "COMPLETE" ? new Date() : null,
  );

  if (nextStep === "COMPLETE") {
    await sendWhatsAppText(
      account.phoneNumberId,
      inbound.from,
      "Onboarding complete. Your WhatsApp assistant is now active.",
    );
    return;
  }

  await promptCurrentStep(account, session, inbound.from);
}
