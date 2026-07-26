import { NextResponse } from "next/server";
import {
  authenticateIntegration,
  writeIntegrationAudit,
} from "@/lib/integration/auth";
import {
  addCommentFromIntegration,
  findTicketByTrackingId,
} from "@/lib/integration/tickets";

export async function POST(req, { params }) {
  const auth = await authenticateIntegration(req, {
    requireScopes: ["tickets:comment"],
  });
  if (!auth.ok) return auth.response;

  const { trackingId } = await params;
  const ticket = await findTicketByTrackingId(decodeURIComponent(trackingId));
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const comment = await addCommentFromIntegration(ticket, body, auth.app);
    await writeIntegrationAudit({
      integrationAppId: auth.app.id,
      method: auth.method,
      path: auth.path,
      statusCode: 201,
      ip: auth.ip,
      ticketId: ticket.id,
      message: "comment added",
    });
    return NextResponse.json(
      {
        id: comment.id,
        text: comment.text,
        isPublic: comment.isPublic,
        createdAt: comment.createdAt,
        author: comment.author?.name || "System",
      },
      { status: 201 }
    );
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: status === 500 ? "Internal Server Error" : error.message },
      { status }
    );
  }
}
