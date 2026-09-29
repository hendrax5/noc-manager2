import { httpError, integrationGet } from "@/lib/integration/handler";
import { getFullTicketForIntegration } from "@/lib/integration/tickets";

export const GET = integrationGet(["tickets:read:full"], async ({ params }) => {
  const ticket = await getFullTicketForIntegration(decodeURIComponent(params.trackingId));
  if (!ticket) throw httpError(404, "Ticket not found");
  return { data: ticket, ticketId: ticket.id, message: "full detail" };
});
