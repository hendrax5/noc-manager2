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

export function replyPointsLog({ actorId, isPublic, commentId }) {
  const kind = isPublic ? "Public reply" : "Internal reply";
  const suffix = commentId ? ` (comment #${commentId})` : "";
  return {
    action: `${kind}: [+${REPLY_POINTS} Pts]${suffix}`,
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

export function resolveJobPointsLog({ recipientId, cat }) {
  return {
    action: `Ticket Resolved: [+${cat.score} Pts] for [${cat.name}] → last reply author.`,
    actorId: recipientId,
    jobCategoryId: cat.id,
    awardedScore: cat.score,
  };
}

const REOPEN_ACTION_FILTER = {
  OR: [
    { action: { contains: "reactivated from Resolved" } },
    { action: { startsWith: "Status changed to [ Open" } },
    { action: { startsWith: "Status changed to [ New" } },
    { action: { startsWith: "Status changed to [ In Progress" } },
    { action: { startsWith: "Status changed to [ Pending" } },
    { action: { startsWith: "Status changed to [ On Hold" } },
    { action: { startsWith: "Status changed to [ Finish" } },
  ],
};

/** True when this resolve cycle has no job-category award yet (allows award after category is set late). */
export async function canAwardResolveJobPoints(prisma, ticketId) {
  const lastJobAward = await prisma.ticketHistory.findFirst({
    where: { ticketId, jobCategoryId: { not: null }, awardedScore: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!lastJobAward) return true;

  const reopenedAfter = await prisma.ticketHistory.findFirst({
    where: {
      ticketId,
      createdAt: { gt: lastJobAward.createdAt },
      ...REOPEN_ACTION_FILTER,
    },
    select: { id: true },
  });
  return Boolean(reopenedAfter);
}
