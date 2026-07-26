import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/lib/config";

export const INTEGRATION_SCOPES = Object.freeze([
  "tickets:create",
  "tickets:read",
  "tickets:comment",
  "tickets:update",
  "webhooks:manage",
]);

export function parseScopes(raw) {
  if (Array.isArray(raw)) return raw.map(String);
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function hashApiKey(rawKey) {
  return crypto.createHash("sha256").update(String(rawKey)).digest("hex");
}

export function generateApiKey() {
  const raw = `noc_${crypto.randomBytes(24).toString("hex")}`;
  return {
    raw,
    keyPrefix: raw.slice(0, 12),
    keyHash: hashApiKey(raw),
  };
}

function getClientIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export async function writeIntegrationAudit({
  integrationAppId,
  method,
  path,
  statusCode,
  ip,
  externalRef,
  ticketId,
  message,
}) {
  try {
    await prisma.integrationAuditLog.create({
      data: {
        integrationAppId: integrationAppId || null,
        method,
        path,
        statusCode,
        ip: ip || null,
        externalRef: externalRef || null,
        ticketId: ticketId || null,
        message: message || null,
      },
    });
  } catch (err) {
    console.warn("[integration:audit]", err.message);
  }
}

async function checkRateLimit(app) {
  const since = new Date(Date.now() - 60_000);
  const count = await prisma.integrationAuditLog.count({
    where: {
      integrationAppId: app.id,
      createdAt: { gte: since },
      statusCode: { lt: 500 },
    },
  });
  return count < (app.rateLimitPerMinute || 60);
}

/**
 * Authenticate X-API-Key against IntegrationApp table, with legacy fallback.
 * @returns {{ ok: true, app, legacy?: boolean } | { ok: false, response: NextResponse }}
 */
export async function authenticateIntegration(req, { requireScopes = [] } = {}) {
  const apiKeyHeader = req.headers.get("x-api-key");
  const ip = getClientIp(req);
  const path = new URL(req.url).pathname;
  const method = req.method;

  if (!apiKeyHeader) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized: missing X-API-Key" }, { status: 401 }),
    };
  }

  const keyHash = hashApiKey(apiKeyHeader);
  let app = await prisma.integrationApp.findFirst({
    where: { keyHash, active: true },
  });

  // Legacy single-key fallback (env / AppSetting)
  if (!app) {
    const config = await getAppConfig();
    const legacy = process.env.EXTERNAL_API_KEY || config.externalApiKey;
    if (legacy && apiKeyHeader === legacy) {
      app = {
        id: null,
        name: "legacy-global",
        scopes: JSON.stringify(INTEGRATION_SCOPES),
        webhookUrl: null,
        webhookSecret: null,
        webhookEvents: "[]",
        defaultDepartmentId: null,
        rateLimitPerMinute: 120,
        active: true,
        legacy: true,
      };
    }
  }

  if (!app) {
    await writeIntegrationAudit({
      method,
      path,
      statusCode: 401,
      ip,
      message: "invalid api key",
    });
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized: Invalid or missing API Key" }, { status: 401 }),
    };
  }

  if (!app.legacy) {
    const allowed = await checkRateLimit(app);
    if (!allowed) {
      await writeIntegrationAudit({
        integrationAppId: app.id,
        method,
        path,
        statusCode: 429,
        ip,
        message: "rate limit exceeded",
      });
      return {
        ok: false,
        response: NextResponse.json({ error: "Too Many Requests" }, { status: 429 }),
      };
    }
  }

  const scopes = parseScopes(app.scopes);
  const missing = requireScopes.filter((s) => !scopes.includes(s));
  if (missing.length > 0) {
    await writeIntegrationAudit({
      integrationAppId: app.id,
      method,
      path,
      statusCode: 403,
      ip,
      message: `missing scopes: ${missing.join(",")}`,
    });
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden", missingScopes: missing },
        { status: 403 }
      ),
    };
  }

  return { ok: true, app: { ...app, scopes }, ip, path, method };
}

export function departmentCodeFromName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function resolveDepartment({ departmentId, departmentCode, fallbackId }) {
  if (departmentId && !isNaN(parseInt(departmentId, 10))) {
    const dept = await prisma.department.findUnique({ where: { id: parseInt(departmentId, 10) } });
    if (dept) return dept;
  }
  if (departmentCode) {
    const code = departmentCodeFromName(departmentCode);
    const all = await prisma.department.findMany();
    const match = all.find((d) => departmentCodeFromName(d.name) === code || d.name.toLowerCase() === String(departmentCode).toLowerCase());
    if (match) return match;
  }
  if (fallbackId) {
    return prisma.department.findUnique({ where: { id: parseInt(fallbackId, 10) } });
  }
  return null;
}
