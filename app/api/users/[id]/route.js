import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.permissions?.includes('settings.manage')) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    const body = await req.json();
    const email = body.email?.toLowerCase();
    const { name, roleId, departmentId } = body;

    if (email) {
      // Check for existing user with this email (excluding current user)
      const existing = await prisma.user.findFirst({
        where: { 
          email: { equals: email, mode: 'insensitive' },
          id: { not: id }
        }
      });

      if (existing) {
        return NextResponse.json({ error: `User with email ${email} already exists.` }, { status: 400 });
      }
    }

    const data = {
      name,
      email,
      roleId: parseInt(roleId),
      departmentId: parseInt(departmentId)
    };

    if (body.password) {
      data.password = body.password;
    }

    const user = await prisma.user.update({
      where: { id },
      data
    });

    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user.permissions?.includes('settings.manage')) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    try {
      await prisma.user.delete({ where: { id } });
      return NextResponse.json({ message: "Deleted" });
    } catch (dbError) {
      // Check for Prisma foreign key constraint error (P2003)
      if (dbError.code === 'P2003') {
        return NextResponse.json({ 
          error: "Cannot delete user because they have associated records (tickets, comments, or reports). Please reassign their work before deleting." 
        }, { status: 400 });
      }
      throw dbError; // Rethrow to be caught by the outer catch
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
