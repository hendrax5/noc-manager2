import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { buildServiceDeskMetrics } from "@/lib/reports/serviceDesk";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "Admin" && session.user.role !== "Manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    return NextResponse.json(await buildServiceDeskMetrics({ days: searchParams.get("days") }));
  } catch (error) {
    console.error("[service-desk]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
