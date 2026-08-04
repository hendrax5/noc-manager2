/** Default activity/job point rules for ticket lifecycle. */
export const CREATE_TICKET_POINTS = 1;
export const REPLY_POINTS = 1;

export function createTicketPointsLog({ actorId, detail = "" }) {
  return {
    action: `Ticket created: [+${CREATE_TICKET_POINTS} Pts]${detail}`,
    actorId,
    awardedScore: CREATE_TICKET_POINTS,
  };
}

export function replyPointsLog({ actorId, isPublic }) {
  const kind = isPublic ? "Public reply" : "Internal reply";
  return {
    action: `${kind}: [+${REPLY_POINTS} Pts]`,
    actorId,
    awardedScore: REPLY_POINTS,
  };
}

/**
 * Job-category points go to the author of the last comment before resolve.
 * Falls back to assignee when the ticket has no replies.
 */
export async function resolveJobRecipientId(prisma, ticketId, fallbackAssigneeId) {
  const lastComment = await prisma.comment.findFirst({
    where: { ticketId },
    orderBy: { createdAt: "desc" },
    select: { authorId: true },
  });
  return lastComment?.authorId || fallbackAssigneeId || null;
}
