import { prisma } from "@/lib/prisma";
import { integrationGet } from "@/lib/integration/handler";

export const GET = integrationGet(
  { anyOf: ["tickets:read", "tickets:read:full", "tickets:create", "dashboard:read"] },
  async ({ query }) => {
    const categories = await prisma.jobCategory.findMany({
      where: query.includeInactive === "true" ? {} : { active: true },
      select: { id: true, name: true, score: true, active: true },
      orderBy: { name: "asc" },
    });
    return { data: { jobCategories: categories }, message: `meta job-categories count=${categories.length}` };
  }
);
