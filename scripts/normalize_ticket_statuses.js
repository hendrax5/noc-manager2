/**
 * Normalize legacy Hesk-style ticket statuses to canonical set.
 * Run: node scripts/normalize_ticket_statuses.js
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const MAP = {
  "Waiting Reply": "Pending",
  Replied: "Open",
};

async function main() {
  for (const [from, to] of Object.entries(MAP)) {
    const result = await prisma.ticket.updateMany({
      where: { status: from },
      data: { status: to },
    });
    console.log(`${from} → ${to}: ${result.count} tickets`);
  }

  const existingRules = await prisma.escalationRule.count();
  if (existingRules === 0) {
    await prisma.escalationRule.createMany({
      data: [
        { name: "Team Lead", fromLevel: 0, toLevel: 1, afterBreachCount: 1, targetRole: null },
        { name: "Manager", fromLevel: 1, toLevel: 2, afterBreachCount: 2, targetRole: "Manager" },
        { name: "Director", fromLevel: 2, toLevel: 3, afterBreachCount: 3, targetRole: "Manager" },
      ],
    });
    console.log("Seeded default escalation rules");
  }

  const queueCount = await prisma.ticketQueue.count();
  if (queueCount === 0) {
    const noc = await prisma.department.findFirst({
      where: { name: { contains: "NOC", mode: "insensitive" } },
    });
    await prisma.ticketQueue.create({
      data: {
        name: "NOC Ops",
        departmentId: noc?.id || null,
        skillTags: JSON.stringify(["network", "noc"]),
      },
    });
    console.log("Seeded default queue: NOC Ops");
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
