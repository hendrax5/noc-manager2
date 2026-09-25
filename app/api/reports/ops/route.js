import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { canViewOpsReport } from "@/lib/reports/opsAccess";
import { buildOpsReport } from "@/lib/reports/opsReport";

/**
 * GET /api/reports/ops?period=week|month|custom&anchor=YYYY-MM-DD&start=&end=
 */
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canViewOpsReport(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const report = await buildOpsReport({
      period: searchParams.get("period"),
      anchor: searchParams.get("anchor"),
      start: searchParams.get("start"),
      end: searchParams.get("end"),
    });
    return NextResponse.json(report);
  } catch (error) {
    console.error("ops report", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
