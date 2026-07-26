import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { generateApiKey, parseScopes } from "@/lib/integration/auth";

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

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!(await requireAdmin(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = parseInt((await params).id, 10);
  const body = await req.json().catch(() => ({}));

  const data = {};
  if (body.name != null) data.name = String(body.name).trim();
  if (body.description !== undefined) data.description = body.description || null;
  if (body.scopes) data.scopes = JSON.stringify(body.scopes);
  if (body.webhookUrl !== undefined) data.webhookUrl = body.webhookUrl || null;
  if (body.webhookSecret !== undefined) data.webhookSecret = body.webhookSecret || null;
  if (body.webhookEvents) data.webhookEvents = JSON.stringify(body.webhookEvents);
  if (body.defaultDepartmentId !== undefined) {
    data.defaultDepartmentId = body.defaultDepartmentId
      ? parseInt(body.defaultDepartmentId, 10)
      : null;
  }
  if (body.rateLimitPerMinute != null) {
    data.rateLimitPerMinute = parseInt(body.rateLimitPerMinute, 10);
  }
  if (body.active != null) data.active = !!body.active;

  let apiKey = null;
  if (body.rotateKey) {
    const key = generateApiKey();
    data.keyPrefix = key.keyPrefix;
    data.keyHash = key.keyHash;
    apiKey = key.raw;
  }

  const app = await prisma.integrationApp.update({ where: { id }, data });
  return NextResponse.json({ ...sanitizeApp(app), ...(apiKey ? { apiKey } : {}) });
}

export async function DELETE(_req, { params }) {
  const session = await getServerSession(authOptions);
  if (!(await requireAdmin(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = parseInt((await params).id, 10);
  await prisma.integrationApp.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
