import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authenticateIntegration,
  departmentCodeFromName,
  writeIntegrationAudit,
} from "@/lib/integration/auth";

export async function GET(req) {
  const authAny = await authenticateIntegration(req, { requireScopes: [] });
  if (!authAny.ok) return authAny.response;
  const scopes = authAny.app.scopes || [];
  if (!scopes.includes("tickets:create") && !scopes.includes("tickets:read")) {
    return NextResponse.json(
      { error: "Forbidden", missingScopes: ["tickets:read"] },
      { status: 403 }
    );
  }

  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  await writeIntegrationAudit({
    integrationAppId: authAny.app.id,
    method: authAny.method,
    path: authAny.path,
    statusCode: 200,
    ip: authAny.ip,
    message: "meta departments",
  });

  return NextResponse.json({
    departments: departments.map((d) => ({
      id: d.id,
      name: d.name,
      code: departmentCodeFromName(d.name),
    })),
  });
}
