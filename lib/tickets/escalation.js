/**
 * Escalation rules (P1).
 */

import { pickLeastBusyAssignee } from "@/lib/tickets/routing";
import { notifyTicketEvent } from "@/lib/notify";

export const DEFAULT_ESCALATION_LEVELS = Object.freeze([
  { level: 1, label: "Team Lead", afterBreachCount: 1 },
  { level: 2, label: "Manager", afterBreachCount: 2 },
  { level: 3, label: "Director", afterBreachCount: 3 },
]);

/**
 * Apply escalation when SLA breach count crosses a threshold.
 * Returns updated ticket fields or null if no change.
 */
export async function maybeEscalateOnBreach(prisma, ticket, actorId = null) {
  if (!ticket || ticket.escalationLevel == null) return null;

  const rules = await prisma.escalationRule.findMany({
    where: { active: true },
    orderBy: { toLevel: "asc" },
  });

  const effectiveRules =
    rules.length > 0
      ? rules
      : DEFAULT_ESCALATION_LEVELS.map((r) => ({
          id: null,
          name: r.label,
          fromLevel: r.level - 1,
          toLevel: r.level,
          afterBreachCount: r.afterBreachCount,
          targetRole: r.level >= 2 ? "Manager" : null,
          targetDepartmentId: null,
          active: true,
        }));

  const next = effectiveRules.find(
    (r) => ticket.slaBreaches >= r.afterBreachCount && ticket.escalationLevel < r.toLevel
  );
  if (!next) return null;

  let newAssigneeId = ticket.assigneeId;
  if (next.targetRole) {
    const managers = await prisma.user.findMany({
      where: {
        role: { name: next.targetRole },
        ...(next.targetDepartmentId || ticket.departmentId
          ? { departmentId: next.targetDepartmentId || ticket.departmentId }
          : {}),
      },
      select: { id: true },
    });
    if (managers.length > 0) {
      newAssigneeId = managers[0].id;
    }
  } else if (next.targetDepartmentId) {
    const picked = await pickLeastBusyAssignee(prisma, {
      departmentId: next.targetDepartmentId,
    });
    if (picked) newAssigneeId = picked;
  }

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      escalationLevel: next.toLevel,
      assigneeId: newAssigneeId,
    },
    include: {
      assignee: { select: { email: true, name: true } },
      watchers: { include: { user: { select: { email: true } } } },
    },
  });

  await prisma.ticketHistory.create({
    data: {
      ticketId: ticket.id,
      action: `Escalated to level ${next.toLevel} (${next.name || "rule"}) — breaches=${ticket.slaBreaches}`,
      actorId: actorId || null,
    },
  });

  const noteAuthorId = actorId || updated.assigneeId || ticket.assigneeId;
  if (noteAuthorId) {
    await prisma.ticketNote.create({
      data: {
        ticketId: ticket.id,
        authorId: noteAuthorId,
        content: `Auto-escalation to level ${next.toLevel}: ${next.name || "Escalation rule"}`,
        noteType: "escalation",
      },
    }).catch(() => {});
  }

  const emails = [];
  if (updated.assignee?.email) emails.push(updated.assignee.email);
  for (const w of updated.watchers || []) {
    if (w.user?.email) emails.push(w.user.email);
  }

  await notifyTicketEvent({
    prisma,
    event: "escalated",
    ticket: updated,
    emails,
    message: `Ticket ${updated.trackingId} escalated to level ${next.toLevel}.`,
  });

  return updated;
}
