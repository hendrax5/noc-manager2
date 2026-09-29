import { prisma } from "@/lib/prisma";
import { integrationGet } from "@/lib/integration/handler";

export const GET = integrationGet(
  { anyOf: ["tickets:read", "tickets:read:full", "tickets:create"] },
  async () => {
    const fields = await prisma.customField.findMany({
      where: { active: true },
      select: { id: true, name: true, type: true, options: true, required: true, position: true },
      orderBy: { id: "asc" },
    });
    return { data: { customFields: fields }, message: `meta custom-fields count=${fields.length}` };
  }
);
