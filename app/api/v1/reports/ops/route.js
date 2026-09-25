import { NextResponse } from "next/server";
import {
  authenticateIntegration,
  writeIntegrationAudit,
} from "@/lib/integration/auth";
import { buildOpsReport } from "@/lib/reports/opsReport";

export async function GET(req) {
  const auth = await authenticateIntegration(req, {
    requireScopes: ["reports:ops:read"],
  });
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const report = await buildOpsReport({
      period: searchParams.get("period"),
      anchor: searchParams.get("anchor"),
      start: searchParams.get("start"),
      end: searchParams.get("end"),
    });
    await writeIntegrationAudit({
      integrationAppId: auth.app.id,
      method: auth.method,
      path: auth.path,
      statusCode: 200,
      ip: auth.ip,
      message: `ops ${report.period} ${report.startDate}..${report.endDate}`,
    });
    return NextResponse.json(report);
  } catch (error) {
    const status = error.status || 500;
    await writeIntegrationAudit({
      integrationAppId: auth.app?.id,
      method: auth.method,
      path: auth.path,
      statusCode: status,
      ip: auth.ip,
      message: error.message,
    });
    return NextResponse.json(
      { error: status === 500 ? "Internal Server Error" : error.message },
      { status }
    );
  }
}
