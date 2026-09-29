import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { canViewUserPerformance } from "@/lib/reports/performanceAccess";
import { buildUserPerformance } from "@/lib/reports/performance";

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const targetUserId = parseInt(resolvedParams.userId);
    if (isNaN(targetUserId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    if (!canViewUserPerformance(session.user, targetUserId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const report = await buildUserPerformance({
      userId: targetUserId,
      start: searchParams.get("start"),
      end: searchParams.get("end"),
    });

    if (!report) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json(report);
  } catch (error) {
    console.error("[performance]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
