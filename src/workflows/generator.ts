import { prisma } from "../lib/prisma";
import { loadBusinessTypeConfig } from "../business-config/resolver";
import { WorkflowType } from "@prisma/client";

export async function generateTenantWorkflows(
  tenantId: string,
  businessType: string,
): Promise<void> {
  const config = loadBusinessTypeConfig(businessType).config;
  const templates = config.workflow_templates ?? [];

  for (const template of templates) {
    await prisma.workflow.create({
      data: {
        tenantId,
        type: (template.type as WorkflowType) ?? "CUSTOM",
        definition: template.steps,
      },
    });
  }
}
