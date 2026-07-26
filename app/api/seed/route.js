import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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

export async function GET() {
  try {
    const adminRole = await prisma.role.upsert({
      where: { name: "Admin" },
      update: { permissions: ALL_PERMISSIONS },
      create: { name: "Admin", permissions: ALL_PERMISSIONS },
    });
    await prisma.role.upsert({ where: { name: "Manager" }, update: {}, create: { name: "Manager" } });
    await prisma.role.upsert({ where: { name: "Staff" }, update: {}, create: { name: "Staff" } });

    const deptNocCore = await prisma.department.upsert({
      where: { name: "NOC Core" },
      update: {},
      create: { name: "NOC Core" },
    });
    await prisma.department.upsert({
      where: { name: "NOC Datacenter" },
      update: {},
      create: { name: "NOC Datacenter" },
    });
    await prisma.department.upsert({ where: { name: "CS" }, update: {}, create: { name: "CS" } });

    const password = await bcrypt.hash("admin", 10);
    const adminUser = await prisma.user.upsert({
      where: { email: "admin@noc.com" },
      update: {
        name: "Super Admin",
        password,
        roleId: adminRole.id,
        departmentId: deptNocCore.id,
      },
      create: {
        email: "admin@noc.com",
        name: "Super Admin",
        password,
        roleId: adminRole.id,
        departmentId: deptNocCore.id,
      },
    });

    return NextResponse.json({
      message: "Default admin ready",
      user: adminUser.email,
      login: { email: "admin@noc.com", password: "admin" },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
