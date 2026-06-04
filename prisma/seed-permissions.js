const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ALL_PERMISSIONS = [
  "view_all_tickets",
  "change_ticket_status",
  "assign_tickets",
  "change_job_category",
  "delete_tickets",
  "manage_users",
  "manage_roles",
  "manage_settings",
  "view_reports",
  "manage_schedules",
  "manage_knowledge",
  "manage_assets",
  "manage_meetings",
  "edit_own_tickets",
  "edit_other_tickets"
];

const MANAGER_PERMISSIONS = [
  "view_all_tickets",
  "change_ticket_status",
  "assign_tickets",
  "change_job_category",
  "view_reports",
  "manage_schedules",
  "manage_knowledge",
  "manage_assets",
  "manage_meetings",
  "edit_own_tickets",
  "edit_other_tickets"
];

async function main() {
  console.log("Starting Roles & Permissions seeding...");

  // 1. Seed or Update Admin Role
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: { permissions: ALL_PERMISSIONS },
    create: {
      name: 'Admin',
      permissions: ALL_PERMISSIONS
    }
  });
  console.log(`Successfully updated role 'Admin' with ${ALL_PERMISSIONS.length} permissions.`);

  // 2. Seed or Update Manager Role
  const managerRole = await prisma.role.upsert({
    where: { name: 'Manager' },
    update: { permissions: MANAGER_PERMISSIONS },
    create: {
      name: 'Manager',
      permissions: MANAGER_PERMISSIONS
    }
  });
  console.log(`Successfully updated role 'Manager' with ${MANAGER_PERMISSIONS.length} permissions.`);

  // 3. Seed or Update default standard User Role
  const userRole = await prisma.role.upsert({
    where: { name: 'User' },
    update: {},
    create: {
      name: 'User',
      permissions: []
    }
  });
  console.log("Successfully seeded default User role.");

  console.log("Roles & Permissions seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
