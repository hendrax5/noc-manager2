import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hashPassword } from "@/lib/auth/password";

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
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      const session = await getServerSession(authOptions);
      if (session?.user?.role !== "Admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

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

    const existingAdmin = await prisma.user.findUnique({
      where: { email: "admin@noc.com" },
      select: { id: true },
    });
    if (existingAdmin) {
      return NextResponse.json({ message: "Roles/departments synced; default admin already exists" });
    }

    const adminUser = await prisma.user.create({
      data: {
        email: "admin@noc.com",
        name: "Super Admin",
        password: await hashPassword("admin"),
        roleId: adminRole.id,
        departmentId: deptNocCore.id,
      },
    });

    return NextResponse.json({
      message: "Default admin created — change this password immediately",
      user: adminUser.email,
      login: { email: "admin@noc.com", password: "admin" },
    });
  } catch (error) {
    console.error("[seed]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
