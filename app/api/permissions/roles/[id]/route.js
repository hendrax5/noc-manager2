import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../api/auth/[...nextauth]/route";

// GET /api/permissions/roles/[id] — Get role's permissions
export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.permissions?.includes('settings.manage')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const resolvedParams = await params;
    const roleId = parseInt(resolvedParams.id);
    
    const rolePerms = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true }
    });

    return NextResponse.json(rolePerms.map(rp => rp.permission));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/permissions/roles/[id] — Update role permissions (full replace)
export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.permissions?.includes('settings.manage')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const resolvedParams = await params;
    const roleId = parseInt(resolvedParams.id);
    const { permissionIds } = await req.json(); // Array of permission IDs

    // Delete all existing role permissions for this role
    await prisma.rolePermission.deleteMany({ where: { roleId } });

    // Create new mappings
    if (permissionIds && permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map(pid => ({ roleId, permissionId: pid })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ success: true, count: permissionIds?.length || 0 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
