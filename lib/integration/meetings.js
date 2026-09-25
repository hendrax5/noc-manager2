import { prisma } from "@/lib/prisma";

function parseIsoDate(value, name) {
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    const err = new Error(`Invalid ${name}; use ISO-8601 datetime`);
    err.status = 400;
    throw err;
  }
  return d;
}

function userBrief(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email };
}

export function publicMeetingListDto(m) {
  return {
    id: m.id,
    title: m.title,
    status: m.status,
    scheduledAt: m.scheduledAt,
    agenda: m.agenda || null,
    organizedBy: userBrief(m.organizedBy),
    attendeeCount: m.attendees?.length ?? m._count?.attendees ?? 0,
    attendees: (m.attendees || []).map(userBrief),
    createdAt: m.createdAt,
  };
}

export function publicMeetingDetailDto(m) {
  return {
    ...publicMeetingListDto(m),
    problems: m.problems || null,
    solutions: m.solutions || null,
    sessions: (m.sessions || []).map((s) => ({
      id: s.id,
      title: s.title,
      scheduledFor: s.scheduledFor,
      content: s.content,
      author: userBrief(s.author),
      presentAttendees: (s.presentAttendees || []).map(userBrief),
      actionItems: (s.actionItems || []).map((a) => ({
        id: a.id,
        task: a.task,
        status: a.status,
        assignee: userBrief(a.assignee),
        department: a.department?.name || null,
      })),
    })),
    actionItems: (m.actionItems || []).map((a) => ({
      id: a.id,
      task: a.task,
      status: a.status,
      assignee: userBrief(a.assignee),
      department: a.department?.name || null,
    })),
  };
}

export async function listMeetingsForIntegration(query = {}) {
  const limitRaw = parseInt(query.limit ?? "50", 10);
  const offsetRaw = parseInt(query.offset ?? "0", 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 100);
  const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);

  const where = {};
  if (query.status) {
    where.status = String(query.status).trim();
  }
  const from = parseIsoDate(query.from, "from");
  const to = parseIsoDate(query.to, "to");
  if (from || to) {
    where.scheduledAt = {};
    if (from) where.scheduledAt.gte = from;
    if (to) where.scheduledAt.lte = to;
  }

  const [total, meetings] = await Promise.all([
    prisma.meeting.count({ where }),
    prisma.meeting.findMany({
      where,
      include: {
        organizedBy: { select: { id: true, name: true, email: true } },
        attendees: { select: { id: true, name: true, email: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: limit,
      skip: offset,
    }),
  ]);

  return {
    meetings: meetings.map(publicMeetingListDto),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + meetings.length < total,
    },
  };
}

export async function getMeetingForIntegration(id) {
  const meetingId = parseInt(id, 10);
  if (!Number.isFinite(meetingId)) {
    const err = new Error("Invalid meeting id");
    err.status = 400;
    throw err;
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      organizedBy: { select: { id: true, name: true, email: true } },
      attendees: { select: { id: true, name: true, email: true } },
      sessions: {
        include: {
          author: { select: { id: true, name: true, email: true } },
          presentAttendees: { select: { id: true, name: true, email: true } },
          actionItems: {
            include: {
              assignee: { select: { id: true, name: true, email: true } },
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { scheduledFor: "asc" },
      },
      actionItems: {
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          department: { select: { name: true } },
        },
      },
    },
  });

  if (!meeting) return null;
  return publicMeetingDetailDto(meeting);
}
