/**
 * Ensure default Admin user exists.
 * Usage (in app container): node scripts/ensure_default_admin.js
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

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
  "edit_other_tickets",
  "manage_tickets",
  "create_tickets",
  "manage_sla",
  "view_internal_notes",
  "manage_ticket_notes",
  "modify_tickets",
  "manage_departments",
  "view_live_ops",
];

const ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || "admin@noc.com";
const ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || "admin";
const ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME || "Super Admin";

async function main() {
  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: { permissions: ALL_PERMISSIONS },
    create: { name: "Admin", permissions: ALL_PERMISSIONS },
  });

  await prisma.role.upsert({
    where: { name: "Manager" },
    update: {},
    create: { name: "Manager", permissions: [] },
  });

  await prisma.role.upsert({
    where: { name: "Staff" },
    update: {},
    create: { name: "Staff", permissions: [] },
  });

  const dept = await prisma.department.upsert({
    where: { name: "NOC Core" },
    update: {},
    create: { name: "NOC Core" },
  });

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      password: hashed,
      roleId: adminRole.id,
      departmentId: dept.id,
    },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      password: hashed,
      roleId: adminRole.id,
      departmentId: dept.id,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: user.email,
        name: user.name,
        role: "Admin",
        department: "NOC Core",
        password: ADMIN_PASSWORD,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
