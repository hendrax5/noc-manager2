import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import {
  INTEGRATION_SCOPES,
  generateApiKey,
  parseScopes,
} from "@/lib/integration/auth";

async function requireAdmin(session) {
  if (!session) return false;
  return session.user?.role === "Admin" || session.user?.permissions?.includes("manage_settings");
}

function sanitizeApp(app) {
  return {
    id: app.id,
    name: app.name,
    description: app.description,
    keyPrefix: app.keyPrefix,
    scopes: parseScopes(app.scopes),
    webhookUrl: app.webhookUrl,
    webhookEvents: parseScopes(app.webhookEvents),
    hasWebhookSecret: !!app.webhookSecret,
    defaultDepartmentId: app.defaultDepartmentId,
    rateLimitPerMinute: app.rateLimitPerMinute,
    active: app.active,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!(await requireAdmin(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const apps = await prisma.integrationApp.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({
    apps: apps.map(sanitizeApp),
    availableScopes: INTEGRATION_SCOPES,
  });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!(await requireAdmin(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (!body.name || !String(body.name).trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const key = generateApiKey();
  const scopes = Array.isArray(body.scopes) && body.scopes.length
    ? body.scopes
    : ["tickets:create", "tickets:read"];

  const app = await prisma.integrationApp.create({
    data: {
      name: String(body.name).trim(),
      description: body.description || null,
      keyPrefix: key.keyPrefix,
      keyHash: key.keyHash,
      scopes: JSON.stringify(scopes),
      webhookUrl: body.webhookUrl || null,
      webhookSecret: body.webhookSecret || key.raw.slice(0, 32),
      webhookEvents: JSON.stringify(
        body.webhookEvents || ["ticket.created", "ticket.status_changed", "ticket.resolved", "ticket.commented", "ticket.sla_breached"]
      ),
      defaultDepartmentId: body.defaultDepartmentId
        ? parseInt(body.defaultDepartmentId, 10)
        : null,
      rateLimitPerMinute: body.rateLimitPerMinute
        ? parseInt(body.rateLimitPerMinute, 10)
        : 60,
      active: body.active !== false,
    },
  });

  return NextResponse.json(
    {
      ...sanitizeApp(app),
      apiKey: key.raw, // shown once
    },
    { status: 201 }
  );
}
