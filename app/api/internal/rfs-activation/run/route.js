import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/integration/cronAuth";
import { prisma } from "@/lib/prisma";
import { activateDueServices } from "@/lib/services/rfsActivation";

/** Monitoring: how many Pending registrations are due for RFS activation (cron-secret protected). */
export async function GET(req) {
  if (!isCronRequest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const due = await prisma.service.count({ where: { status: "Pending", plannedActiveAt: { not: null, lte: new Date() } } });
  return NextResponse.json({ due });
}

/** Hourly sweep: Pending -> Active when the RFS instant has passed. Never touches tickets. */
export async function POST(req) {
  if (!isCronRequest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const limit = Number(new URL(req.url).searchParams.get("limit")) || 100;
  const summary = await activateDueServices(prisma, { limit });
  return NextResponse.json(summary);
}
