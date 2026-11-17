import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { previewAllDepartmentsMonth } from "@/lib/schedules/generatePola";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    const hasPermission =
      session?.user?.permissions?.includes("manage_schedules") ||
      session?.user?.role === "Admin";
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || "", 10);
    const month = parseInt(searchParams.get("month") || "", 10);
    const departmentId = searchParams.get("departmentId");

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "year and month (1-12) are required" },
        { status: 400 }
      );
    }

    const departments = await previewAllDepartmentsMonth({
      year,
      month,
      departmentId: departmentId || null,
    });

    const summary = departments.reduce(
      (acc, d) => {
        acc.existingCount += d.existingCount;
        acc.manualProtectedCount += d.manualProtectedCount;
        acc.eligibleUserCount += d.eligibleUserCount;
        acc.resignedCount += d.resignedCount;
        acc.nonShiftCount += d.nonShiftCount;
        return acc;
      },
      {
        existingCount: 0,
        manualProtectedCount: 0,
        eligibleUserCount: 0,
        resignedCount: 0,
        nonShiftCount: 0,
      }
    );

    return NextResponse.json({
      year,
      month,
      summary,
      departments,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 }
    );
  }
}
