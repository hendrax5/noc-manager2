import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/integration/cronAuth";
import { isDriveConfigured } from "@/lib/integration/gdrive";
import { backfillAttachments } from "@/lib/integration/driveSync";

/**
 * Operator tool for legacy attachments (cron-secret protected).
 * Body: { id?: number, limit?: number, status?: "skipped" | "failed" }
 * Example: curl -X POST -H "x-cron-secret: ..." -d '{"id":2644}' .../api/internal/drive-sync/backfill
 */
export async function POST(req) {
  if (!isCronRequest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isDriveConfigured()) {
    return NextResponse.json({ configured: false, processed: 0, results: [] }, { status: 200 });
  }
  const body = await req.json().catch(() => ({}));
  const status = body.status === "failed" ? "failed" : "skipped";
  const summary = await backfillAttachments({
    id: body.id ?? null,
    limit: body.limit ?? 10,
    status,
  });
  return NextResponse.json(summary);
}
