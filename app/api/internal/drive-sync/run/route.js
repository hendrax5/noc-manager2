import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/integration/cronAuth";
import { isDriveConfigured } from "@/lib/integration/gdrive";
import { driveAttachmentStats, syncPendingAttachments } from "@/lib/integration/driveSync";

/** Monitoring: Drive archive counters (cron-secret protected). */
export async function GET(req) {
  if (!isCronRequest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isDriveConfigured()) return NextResponse.json({ configured: false, counts: {} });
  return NextResponse.json({ configured: true, counts: await driveAttachmentStats() });
}

/** Cron sweep: upload pending attachments in a small batch. */
export async function POST(req) {
  if (!isCronRequest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const limit = Number(new URL(req.url).searchParams.get("limit")) || 10;
  const summary = await syncPendingAttachments({ limit });
  return NextResponse.json(summary);
}
