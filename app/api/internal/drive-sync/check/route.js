import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/integration/cronAuth";
import { checkDriveAccess, isDriveConfigured } from "@/lib/integration/gdrive";

/**
 * Read-only preflight for activation: exchanges credentials for a token and reads the
 * destination folder metadata. Cron-secret protected; never writes to Drive.
 */
export async function GET(req) {
  if (!isCronRequest(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isDriveConfigured()) {
    return NextResponse.json({ ok: false, configured: false, error: "Google Drive belum dikonfigurasi." });
  }
  try {
    return NextResponse.json(await checkDriveAccess());
  } catch (error) {
    return NextResponse.json({ ok: false, configured: true, error: error?.message || String(error) });
  }
}
