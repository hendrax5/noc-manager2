/**
 * Time-to-resolve for the latest resolve cycle: starts at `customData.reopenedAt`
 * (set when a resolved ticket is reactivated) or `createdAt`, ends at `resolvedAt`.
 * Returns 0 when the ticket has no usable end time or the span is not positive.
 */
export function ticketTtrMs(ticket, { fallbackToUpdatedAt = false } = {}) {
  const endAt = ticket.resolvedAt || (fallbackToUpdatedAt ? ticket.updatedAt : null);
  if (!endAt) return 0;
  const cd = ticket.customData && typeof ticket.customData === "object" ? ticket.customData : {};
  const startAt = cd.reopenedAt || ticket.createdAt;
  const diff = new Date(endAt).getTime() - new Date(startAt).getTime();
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}
