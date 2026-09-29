import { NextResponse } from "next/server";
import { authenticateIntegration, writeIntegrationAudit } from "@/lib/integration/auth";

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Read-only Integration API route: X-API-Key auth + scope check, audit log, uniform errors.
 * `scopes` is either an array (all required) or `{ anyOf: [...] }` (at least one required).
 * `handler({ query, params, auth })` returns `{ data, message?, ticketId? }`; throw `httpError()` for 4xx.
 */
export function integrationGet(scopes, handler) {
  const anyOf = Array.isArray(scopes) ? null : scopes.anyOf;
  const requireScopes = Array.isArray(scopes) ? scopes : [];

  return async function GET(req, ctx) {
    const auth = await authenticateIntegration(req, { requireScopes });
    if (!auth.ok) return auth.response;

    const audit = (statusCode, extra = {}) =>
      writeIntegrationAudit({
        integrationAppId: auth.app.id,
        method: auth.method,
        path: auth.path,
        statusCode,
        ip: auth.ip,
        ...extra,
      });

    if (anyOf && !anyOf.some((s) => auth.app.scopes.includes(s))) {
      await audit(403, { message: `missing any of scopes: ${anyOf.join(",")}` });
      return NextResponse.json({ error: "Forbidden", missingScopes: anyOf }, { status: 403 });
    }

    try {
      const query = Object.fromEntries(new URL(req.url).searchParams.entries());
      const params = ctx?.params ? await ctx.params : {};
      const { data, message, ticketId } = await handler({ query, params, auth });
      await audit(200, { message, ticketId });
      return NextResponse.json(data);
    } catch (error) {
      const status = error.status || 500;
      if (status === 500) console.error(`[integration] ${auth.method} ${auth.path}`, error);
      await audit(status, { message: error.message });
      return NextResponse.json(
        { error: status === 500 ? "Internal Server Error" : error.message },
        { status }
      );
    }
  };
}

export function parseIntParam(value, name) {
  if (value == null || value === "") return null;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) throw httpError(400, `Invalid ${name}`);
  return n;
}

export function parseYmdParam(value, name) {
  if (value == null || value === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    throw httpError(400, `Invalid ${name}; use YYYY-MM-DD`);
  }
  return String(value);
}
