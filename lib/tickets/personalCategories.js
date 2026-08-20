/**
 * Personal job categories (Daily Report / Laporan Harian).
 * Staff only see their own tickets; Admin/Manager see all.
 * These tickets are excluded from the Live Operations Board.
 */

const PERSONAL_NAME_MARKERS = ["daily report", "laporan harian", "dailyreport"];

export function isPersonalCategoryName(name) {
  const n = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
  if (!n) return false;
  const compact = n.replace(/\s/g, "");
  return PERSONAL_NAME_MARKERS.some((marker) => n.includes(marker) || compact.includes(marker.replace(/\s/g, "")));
}

export function canViewAllPersonalTickets(user) {
  const role = user?.role;
  return role === "Admin" || role === "Manager";
}

export async function getPersonalCategoryIds(prisma) {
  const cats = await prisma.jobCategory.findMany({
    select: { id: true, name: true },
  });
  return cats.filter((c) => isPersonalCategoryName(c.name)).map((c) => c.id);
}

/** Merge Prisma where objects without clobbering sibling OR/AND keys. */
export function andWhere(...clauses) {
  const parts = clauses.filter(
    (c) => c && typeof c === "object" && Object.keys(c).length > 0
  );
  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { AND: parts };
}

/**
 * Staff cannot see other people's personal-category tickets.
 * Admin/Manager are unrestricted (still subject to the caller's other scope).
 */
export function personalTicketGuard({ user, personalCategoryIds }) {
  if (!personalCategoryIds?.length) return {};
  if (canViewAllPersonalTickets(user)) return {};
  const userId = parseInt(user?.id, 10);
  if (!Number.isInteger(userId)) {
    return {
      OR: [
        { jobCategoryId: null },
        { jobCategoryId: { notIn: personalCategoryIds } },
      ],
    };
  }
  return {
    OR: [
      { jobCategoryId: null },
      { jobCategoryId: { notIn: personalCategoryIds } },
      { assigneeId: userId },
    ],
  };
}

/** Always hide personal tickets from Live Operations Board. */
export function excludePersonalFromLiveOps(personalCategoryIds) {
  if (!personalCategoryIds?.length) return {};
  return {
    OR: [
      { jobCategoryId: null },
      { jobCategoryId: { notIn: personalCategoryIds } },
    ],
  };
}

export function canAccessPersonalTicket(user, ticket) {
  if (!ticket) return false;
  if (!isPersonalCategoryName(ticket.jobCategory?.name)) return true;
  if (canViewAllPersonalTickets(user)) return true;
  const userId = parseInt(user?.id, 10);
  return Number.isInteger(userId) && ticket.assigneeId === userId;
}
