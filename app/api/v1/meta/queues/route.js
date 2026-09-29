import { prisma } from "@/lib/prisma";
import { integrationGet } from "@/lib/integration/handler";
import { parseScopes } from "@/lib/integration/auth";

export const GET = integrationGet(
  { anyOf: ["tickets:read", "tickets:read:full", "tickets:create"] },
  async () => {
    const queues = await prisma.ticketQueue.findMany({
      select: {
        id: true,
        name: true,
        active: true,
        skillTags: true,
        department: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
    return {
      data: { queues: queues.map((q) => ({ ...q, skillTags: parseScopes(q.skillTags) })) },
      message: `meta queues count=${queues.length}`,
    };
  }
);
