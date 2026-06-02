import { NextResponse } from "next/server";
import { getAppConfig, updateAppConfig } from "@/lib/config";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = getAppConfig();
  return NextResponse.json(config.dashboardDeptConfig || {});
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only Admin can modify settings
  const dbUser = await prisma.user.findUnique({
    where: { id: parseInt(session.user.id) },
    include: { role: true }
  });
  if (!dbUser || dbUser.role.name !== 'Admin') {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const updated = updateAppConfig({ dashboardDeptConfig: body });
    return NextResponse.json(updated.dashboardDeptConfig);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
