import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { buildWorkHours } from "@/lib/reports/workHours";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user } = session;
    const hasPermission = user.permissions?.includes('view_reports') || user.role === 'Admin' || user.role === 'Manager';
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date; use YYYY-MM-DD" }, { status: 400 });
    }

    const report = await buildWorkHours({
      date,
      locationId: parseInt(searchParams.get("locationId"), 10) || null,
      departmentId: parseInt(searchParams.get("departmentId"), 10) || null,
    });
    return NextResponse.json(report);
  } catch (error) {
    console.error("[work-hours]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
