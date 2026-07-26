/**
 * Assignment / queue routing (P1).
 * Least-busy within department, optionally filtered by skill tags + queue.
 */

import { OPEN_STATUSES, expandStatusesForQuery } from "@/lib/tickets/status";

function parseTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function tagsOverlap(userTags, requiredTags) {
  if (!requiredTags || requiredTags.length === 0) return true;
  const set = new Set(userTags.map((t) => t.toLowerCase()));
  return requiredTags.some((t) => set.has(String(t).toLowerCase()));
}

/**
 * Pick least-busy eligible assignee.
 */
export async function pickLeastBusyAssignee(prisma, { departmentId, queueId, excludeAdmin = true, excludeUserIds = [] }) {
  if (!departmentId && !queueId) return null;

  let requiredSkills = [];
  let deptId = departmentId ? parseInt(departmentId, 10) : null;

  if (queueId) {
    const queue = await prisma.ticketQueue.findUnique({ where: { id: parseInt(queueId, 10) } });
    if (queue) {
      requiredSkills = parseTags(queue.skillTags);
      if (queue.departmentId) deptId = queue.departmentId;
    }
  }

  const where = {
    ...(deptId ? { departmentId: deptId } : {}),
    ...(excludeAdmin ? { role: { name: { not: "Admin" } } } : {}),
    ...(excludeUserIds.length ? { id: { notIn: excludeUserIds.map((id) => parseInt(id, 10)) } } : {}),
  };

  const users = await prisma.user.findMany({
    where,
    select: { id: true, skillTags: true },
  });

  const eligible = users.filter((u) => tagsOverlap(parseTags(u.skillTags), requiredSkills));
  const pool = eligible.length > 0 ? eligible : users;
  if (pool.length === 0) return null;

  const openStatuses = expandStatusesForQuery([...OPEN_STATUSES]);
  const activeTicketsCount = await prisma.ticket.groupBy({
    by: ["assigneeId"],
    where: {
      assigneeId: { in: pool.map((u) => u.id) },
      status: { in: openStatuses },
    },
    _count: { id: true },
  });

  const loadMap = {};
  pool.forEach((u) => {
    loadMap[u.id] = 0;
  });
  activeTicketsCount.forEach((l) => {
    if (l.assigneeId) loadMap[l.assigneeId] = l._count.id;
  });

  let minLoad = Infinity;
  let best = null;
  for (const [uid, count] of Object.entries(loadMap)) {
    if (count < minLoad) {
      minLoad = count;
      best = parseInt(uid, 10);
    }
  }
  return best;
}
