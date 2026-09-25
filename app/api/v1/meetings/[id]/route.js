import { NextResponse } from "next/server";
import {
  authenticateIntegration,
  writeIntegrationAudit,
} from "@/lib/integration/auth";
import { getMeetingForIntegration } from "@/lib/integration/meetings";

export async function GET(req, { params }) {
  const auth = await authenticateIntegration(req, {
    requireScopes: ["meetings:read"],
  });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const meeting = await getMeetingForIntegration(id);
    if (!meeting) {
      await writeIntegrationAudit({
        integrationAppId: auth.app.id,
        method: auth.method,
        path: auth.path,
        statusCode: 404,
        ip: auth.ip,
        message: "meeting not found",
      });
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    await writeIntegrationAudit({
      integrationAppId: auth.app.id,
      method: auth.method,
      path: auth.path,
      statusCode: 200,
      ip: auth.ip,
      message: `meeting ${meeting.id}`,
    });
    return NextResponse.json(meeting);
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: status === 500 ? "Internal Server Error" : error.message },
      { status }
    );
  }
}
