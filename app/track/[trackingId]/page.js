import { prisma } from "@/lib/prisma";
import { normalizeStatus, isTerminalStatus } from "@/lib/tickets/status";
import TrackClient from "./TrackClient";

export default async function TrackPage({ params }) {
  const resolved = await params;
  const trackingId = decodeURIComponent(resolved.trackingId);

  // Public page: lookup by unguessable trackingId only, never by sequential id.
  const ticket = await prisma.ticket.findUnique({
    where: { trackingId },
    select: {
      trackingId: true,
      title: true,
      status: true,
      priority: true,
      ticketType: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      csatScore: true,
      comments: {
        where: { isPublic: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          text: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });

  if (!ticket) {
    return (
      <div className="container" style={{ paddingTop: "3rem" }}>
        <h1>Ticket not found</h1>
        <p style={{ color: "var(--muted-text)" }}>
          Check the tracking ID and try again.
        </p>
      </div>
    );
  }

  const view = {
    ...ticket,
    status: normalizeStatus(ticket.status),
    canCsat: isTerminalStatus(ticket.status) && !ticket.csatScore,
  };

  return <TrackClient ticket={view} />;
}
