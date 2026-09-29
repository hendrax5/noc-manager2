import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { buildSlaAnalytics } from "@/lib/reports/slaAnalytics";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hasAccess =
      session.user.role === "Admin" ||
      session.user.role === "Manager" ||
      session.user.permissions?.includes("view_reports");
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const report = await buildSlaAnalytics({
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      customer: searchParams.get("customer") || "",
      signatory: {
        nocName: session.user.name || "NOC",
        nocTitle: session.user.role === "Admin" ? "NOC Manager" : session.user.role || "NOC",
      },
    });
    return NextResponse.json(report);
  } catch (error) {
    console.error("Error generating SLA report:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
