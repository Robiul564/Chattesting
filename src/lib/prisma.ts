import { Prisma, PrismaClient } from "@prisma/client";

const tenantScopedModels = new Set([
  "WhatsAppAccount",
  "Business",
  "Department",
  "Staff",
  "Service",
  "KnowledgeItem",
  "Workflow",
  "Conversation",
  "Booking",
  "AnalyticsEvent",
  "WeeklyReport",
  "VectorChunk",
]);

export const prisma = new PrismaClient();

prisma.$use(async (params, next) => {
  const model = params.model;
  const action = params.action;

  if (!model || !tenantScopedModels.has(model)) {
    return next(params);
  }

  const args = (params.args ?? {}) as Record<string, unknown>;

  const requireWhereTenant = new Set([
    "findMany",
    "findFirst",
    "updateMany",
    "deleteMany",
    "count",
  ]);

  if (requireWhereTenant.has(action)) {
    const where = args.where as Record<string, unknown> | undefined;
    if (!where || where.tenantId === undefined) {
      throw new Error(
        `Tenant guard: ${model}.${action} requires where.tenantId`
      );
    }
  }

  if (action === "create") {
    const data = args.data as Record<string, unknown> | undefined;
    if (!data || data.tenantId === undefined) {
      throw new Error(
        `Tenant guard: ${model}.${action} requires data.tenantId`
      );
    }
  }

  return next(params as Prisma.MiddlewareParams);
});
