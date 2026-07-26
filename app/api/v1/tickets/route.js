import { NextResponse } from "next/server";
import {
  authenticateIntegration,
  writeIntegrationAudit,
} from "@/lib/integration/auth";
import { createTicketFromIntegration, publicTicketDto } from "@/lib/integration/tickets";

export async function POST(req) {
  const auth = await authenticateIntegration(req, {
    requireScopes: ["tickets:create"],
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const idempotencyKey =
      req.headers.get("idempotency-key") || body.idempotencyKey || null;

    const { ticket, replayed } = await createTicketFromIntegration({
      body,
      app: auth.app,
      idempotencyKey,
    });

    await writeIntegrationAudit({
      integrationAppId: auth.app.id,
      method: auth.method,
      path: auth.path,
      statusCode: replayed ? 200 : 201,
      ip: auth.ip,
      externalRef: ticket.externalRef,
      ticketId: ticket.id,
      message: replayed ? "idempotent replay" : "created",
    });

    return NextResponse.json(
      { ...publicTicketDto(ticket), replayed: !!replayed },
      { status: replayed ? 200 : 201 }
    );
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
