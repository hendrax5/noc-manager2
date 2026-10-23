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
      purpose: true,
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

  if (!ticket || ticket.purpose === 'PersonalMonthlyReport') {
    return (
      <div className="container ui-static-57c84916d4" >
        <h1>Ticket not found</h1>
        <p className="ui-static-a64efbfeda" >
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
