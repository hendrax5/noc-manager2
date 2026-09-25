import { NextResponse } from "next/server";
import {
  authenticateIntegration,
  writeIntegrationAudit,
} from "@/lib/integration/auth";
import { listDailyReportsForIntegration } from "@/lib/integration/dailyReports";

export async function GET(req) {
  const auth = await authenticateIntegration(req, {
    requireScopes: ["reports:daily:read"],
  });
  if (!auth.ok) return auth.response;

  try {
    const query = Object.fromEntries(new URL(req.url).searchParams.entries());
    const result = await listDailyReportsForIntegration(query);
    await writeIntegrationAudit({
      integrationAppId: auth.app.id,
      method: auth.method,
      path: auth.path,
      statusCode: 200,
      ip: auth.ip,
      message: `daily reports total=${result.pagination.total}`,
    });
    return NextResponse.json(result);
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
