import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

// GET /api/permissions — List all permissions grouped
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.permissions?.includes('settings.manage')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const permissions = await prisma.permission.findMany({ orderBy: [{ group: 'asc' }, { id: 'asc' }] });
    const roles = await prisma.role.findMany({ 
      include: { 
        permissions: { include: { permission: true } } 
      },
      orderBy: { id: 'asc' }
    });

    return NextResponse.json({ permissions, roles });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
