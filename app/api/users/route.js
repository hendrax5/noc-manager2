import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { hashPassword, omitPassword } from "@/lib/auth/password";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id, 10) },
      include: { role: true },
    });

    const hasPermission =
      dbUser?.role?.permissions?.includes("manage_users") || dbUser?.role?.name === "Admin";
    if (!dbUser || !hasPermission) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { email, name, password, roleId, departmentId, locationId, scheduleEligible, scheduleFlag } =
      body;

    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail) {
      return NextResponse.json({ error: "Email wajib diisi" }, { status: 400 });
    }
    if (!password || !String(password).trim()) {
      return NextResponse.json({ error: "Password wajib diisi" }, { status: 400 });
    }

    const existing = await prisma.user.findFirst({
      where: { email: { equals: cleanEmail, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    }

    const roleIdInt = parseInt(roleId, 10);
    const deptIdInt = parseInt(departmentId, 10);
    const role = await prisma.role.findUnique({ where: { id: roleIdInt } });
    const defaultEligible = role?.name === "Manager" ? false : true;

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        name: name ? String(name).trim() : null,
        password: await hashPassword(password),
        roleId: roleIdInt,
        departmentId: deptIdInt,
        ...(locationId ? { locationId: parseInt(locationId, 10) } : {}),
        active: true,
        scheduleEligible:
          typeof scheduleEligible === "boolean" ? scheduleEligible : defaultEligible,
        ...(scheduleFlag && ["Umum", "Kristen", "Kuliah"].includes(scheduleFlag)
          ? { scheduleFlag }
          : {}),
      },
      include: { role: true, department: true, location: true },
    });
    return NextResponse.json(omitPassword(user), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
