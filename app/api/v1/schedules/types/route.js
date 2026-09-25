import { NextResponse } from "next/server";
import {
  authenticateIntegration,
  writeIntegrationAudit,
} from "@/lib/integration/auth";
import { listShiftTypesForIntegration } from "@/lib/integration/schedules";

export async function GET(req) {
  const auth = await authenticateIntegration(req, {
    requireScopes: ["schedules:read"],
  });
  if (!auth.ok) return auth.response;

  try {
    const result = await listShiftTypesForIntegration();
    await writeIntegrationAudit({
      integrationAppId: auth.app.id,
      method: auth.method,
      path: auth.path,
      statusCode: 200,
      ip: auth.ip,
      message: `shift types=${result.types.length}`,
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: status === 500 ? "Internal Server Error" : error.message },
      { status }
    );
  }
}
