import { NextResponse } from "next/server";
import {
  authenticateIntegration,
  writeIntegrationAudit,
} from "@/lib/integration/auth";
import {
  findTicketByTrackingId,
  patchTicketFromIntegration,
  publicTicketDto,
} from "@/lib/integration/tickets";

export async function GET(req, { params }) {
  const auth = await authenticateIntegration(req, {
    requireScopes: ["tickets:read"],
  });
  if (!auth.ok) return auth.response;

  const { trackingId } = await params;
  const ticket = await findTicketByTrackingId(decodeURIComponent(trackingId));
  if (!ticket) {
    await writeIntegrationAudit({
      integrationAppId: auth.app.id,
      method: auth.method,
      path: auth.path,
      statusCode: 404,
      ip: auth.ip,
      message: "not found",
    });
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  await writeIntegrationAudit({
    integrationAppId: auth.app.id,
    method: auth.method,
    path: auth.path,
    statusCode: 200,
    ip: auth.ip,
    ticketId: ticket.id,
    externalRef: ticket.externalRef,
  });

  return NextResponse.json(publicTicketDto(ticket));
}

export async function PATCH(req, { params }) {
  const auth = await authenticateIntegration(req, {
    requireScopes: ["tickets:update"],
  });
  if (!auth.ok) return auth.response;

  const { trackingId } = await params;
  const ticket = await findTicketByTrackingId(decodeURIComponent(trackingId));
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const updated = await patchTicketFromIntegration(ticket, body, auth.app);
    await writeIntegrationAudit({
      integrationAppId: auth.app.id,
      method: auth.method,
      path: auth.path,
      statusCode: 200,
      ip: auth.ip,
      ticketId: ticket.id,
      externalRef: ticket.externalRef,
      message: "patched",
    });
    return NextResponse.json(publicTicketDto(updated));
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: status === 500 ? "Internal Server Error" : error.message },
      { status }
    );
  }
}
