import { NextResponse } from "next/server";
import {
  authenticateIntegration,
  writeIntegrationAudit,
} from "@/lib/integration/auth";
import { getDailyReportForIntegration } from "@/lib/integration/dailyReports";

export async function GET(req, { params }) {
  const auth = await authenticateIntegration(req, {
    requireScopes: ["reports:daily:read"],
  });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const report = await getDailyReportForIntegration(id);
    if (!report) {
      await writeIntegrationAudit({
        integrationAppId: auth.app.id,
        method: auth.method,
        path: auth.path,
        statusCode: 404,
        ip: auth.ip,
        message: "daily report not found",
      });
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    await writeIntegrationAudit({
      integrationAppId: auth.app.id,
      method: auth.method,
      path: auth.path,
      statusCode: 200,
      ip: auth.ip,
      message: `daily report ${report.id}`,
    });
    return NextResponse.json(report);
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: status === 500 ? "Internal Server Error" : error.message },
      { status }
    );
  }
}
