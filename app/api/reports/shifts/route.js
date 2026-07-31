import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { canViewShiftFairnessReport } from "@/lib/schedules/access";
import { dateOnlyToUtcDate } from "@/lib/schedules/dates";
import { buildDeptSummaries } from "@/lib/schedules/fairness";

/**
 * GET /api/reports/shifts?year=&month=&departmentId=
 */
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canViewShiftFairnessReport(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year"), 10);
    const month = parseInt(searchParams.get("month"), 10);
    const departmentId = parseInt(searchParams.get("departmentId"), 10);

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isInteger(departmentId) ||
      departmentId <= 0
    ) {
      return NextResponse.json(
        { error: "year, month (1–12), and departmentId are required" },
        { status: 400 }
      );
    }

    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true, schedulePola: true },
    });
    if (!dept) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const monthStart = dateOnlyToUtcDate(
      `${year}-${String(month).padStart(2, "0")}-01`
    );
    const next =
      month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
    const monthEnd = dateOnlyToUtcDate(
      `${next.year}-${String(next.month).padStart(2, "0")}-01`
    );

    const schedules = await prisma.shiftSchedule.findMany({
      where: {
        date: { gte: monthStart, lt: monthEnd },
        user: { departmentId },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, departmentId: true },
        },
        shiftType: true,
      },
      orderBy: [{ userId: "asc" }, { date: "asc" }],
    });

    const summary = buildDeptSummaries({
      schedules,
      pola: dept.schedulePola,
      year,
      month,
    });

    return NextResponse.json({
      departmentId,
      department: dept.name,
      ...summary,
    });
  } catch (error) {
    console.error("shift fairness report", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
