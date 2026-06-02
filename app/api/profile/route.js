import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, currentPassword, newPassword, avatarUrl, signature } = body;
    const userId = parseInt(session.user.id);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (signature !== undefined) updateData.signature = signature;

    // Handle password edits (supporting both bcrypt and plain-text)
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: "Current password is required to set a new password" }, { status: 400 });
      }
      
      let isCurrentPasswordCorrect = false;
      const dbPassword = user.password;
      const cleanCurrent = currentPassword.trim();
      
      // Try bcrypt comparison (supporting standard and PHP prefixes)
      if (dbPassword.startsWith('$2a$') || dbPassword.startsWith('$2b$') || dbPassword.startsWith('$2y$') || dbPassword.startsWith('$2x$')) {
        try {
          isCurrentPasswordCorrect = await bcrypt.compare(cleanCurrent, dbPassword);
        } catch (e) {
          isCurrentPasswordCorrect = false;
        }
      }
      
      // Fallback to plain text
      if (!isCurrentPasswordCorrect && dbPassword === cleanCurrent) {
        isCurrentPasswordCorrect = true;
      }
      
      if (!isCurrentPasswordCorrect) {
        return NextResponse.json({ error: "Incorrect current password" }, { status: 401 });
      }
      
      updateData.password = newPassword.trim();
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    return NextResponse.json({ success: true, user: { name: updatedUser.name, avatarUrl: updatedUser.avatarUrl, signature: updatedUser.signature } });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
