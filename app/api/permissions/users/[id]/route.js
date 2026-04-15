import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../api/auth/[...nextauth]/route";

// GET /api/permissions/users/[id] — Get user's permission overrides
export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.permissions?.includes('settings.manage')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.id);
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, role: true, department: true,
        userPermissions: {
          include: { permission: true }
        }
      }
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Get role defaults for context
    const rolePerms = await prisma.rolePermission.findMany({
      where: { roleId: user.role.id },
      include: { permission: true }
    });

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role.name, department: user.department.name },
      rolePermissions: rolePerms.map(rp => rp.permission),
      userOverrides: user.userPermissions.map(up => ({
        permissionId: up.permission.id,
        key: up.permission.key,
        label: up.permission.label,
        group: up.permission.group,
        granted: up.granted,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/permissions/users/[id] — Update user permission overrides
export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.permissions?.includes('settings.manage')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.id);
    const { overrides } = await req.json(); // Array of { permissionId, granted }

    // Delete existing overrides
    await prisma.userPermission.deleteMany({ where: { userId } });

    // Create new overrides
    if (overrides && overrides.length > 0) {
      await prisma.userPermission.createMany({
        data: overrides.map(o => ({
          userId,
          permissionId: o.permissionId,
          granted: o.granted,
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ success: true, count: overrides?.length || 0 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
