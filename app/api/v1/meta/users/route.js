import { prisma } from "@/lib/prisma";
import { integrationGet, parseIntParam } from "@/lib/integration/handler";

export const GET = integrationGet(
  { anyOf: ["tickets:read", "tickets:read:full", "reports:performance:read", "dashboard:read"] },
  async ({ query }) => {
    const departmentId = parseIntParam(query.departmentId, "departmentId");
    const users = await prisma.user.findMany({
      where: departmentId ? { departmentId } : {},
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { name: true } },
        department: { select: { id: true, name: true } },
        location: { select: { id: true, city: true } },
      },
      orderBy: { name: "asc" },
    });
    return {
      data: {
        users: users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role?.name || null,
          department: u.department,
          location: u.location,
        })),
      },
      message: `meta users count=${users.length}`,
    };
  }
);
