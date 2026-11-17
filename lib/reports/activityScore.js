import {jakartaMonthRange} from './monthPeriod.js';

const toWibMonthKey = value => new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 7);
const round1 = value => Math.round(value * 10) / 10;

function percentile(sorted, p) {
  if (!sorted.length) return null;
  return round1(sorted[Math.ceil(sorted.length * p) - 1]);
}

function coalesceMonthRanges(monthKeys) {
  const unique = [...new Set(monthKeys)].sort();
  if (!unique.length) return [];
  const ranges = [];
  for (const key of unique) {
    const r = jakartaMonthRange(key);
    const prev = ranges[ranges.length - 1];
    if (prev && prev.lt.getTime() === r.gte.getTime()) {
      prev.lt = r.lt;
      prev.keys.push(key);
    } else {
      ranges.push({gte: r.gte, lt: r.lt, keys: [key]});
    }
  }
  return ranges;
}

/** Monthly operational metrics for a set of users: resolutions, responses and points. */
export async function loadActivityMetrics(db, {userIds, month}) {
  const ids = [...new Set(userIds.map(Number).filter(Number.isSafeInteger))];
  if (!ids.length) return new Map();
  const range = jakartaMonthRange(month);
  const [resolvedRows, commentRows, ledgerRows, legacyRows] = await Promise.all([
    db.ticket.groupBy({by: ['assigneeId'], where: {assigneeId: {in: ids}, resolvedAt: range}, _count: {_all: true}}),
    db.comment.groupBy({by: ['authorId'], where: {authorId: {in: ids}, createdAt: range}, _count: {_all: true}}),
    db.ticketHistory.groupBy({by: ['actorId'], where: {actorId: {in: ids}, createdAt: range}, _sum: {awardedScore: true}}),
    db.ticket.groupBy({by: ['assigneeId'], where: {assigneeId: {in: ids}, resolvedAt: range}, _sum: {awardedScore: true}}),
  ]);
  const resolved = new Map(resolvedRows.map(row => [row.assigneeId, row._count._all]));
  const responses = new Map(commentRows.map(row => [row.authorId, row._count._all]));
  const ledger = new Map(ledgerRows.map(row => [row.actorId, row._sum.awardedScore || 0]));
  const legacy = new Map(legacyRows.map(row => [row.assigneeId, row._sum.awardedScore || 0]));
  return new Map(ids.map(id => [id, {resolved: resolved.get(id) || 0, responses: responses.get(id) || 0, points: (ledger.get(id) || 0) + (legacy.get(id) || 0)}]));
}

/**
 * Loads operational KPIs (resolutions, points, comments, response speed, SLA & deadline adherence)
 * across multiple WIB monthKeys in constant batched queries per contiguous range.
 */
export async function loadTeamOperationalWindow(db, {userIds, monthKeys}) {
  const ids = [...new Set((userIds || []).map(Number).filter(Number.isSafeInteger))];
  const uniqueMonths = [...new Set(monthKeys || [])];
  const byMonth = new Map();
  for (const m of uniqueMonths) {
    jakartaMonthRange(m);
    byMonth.set(m, new Map());
  }
  if (!ids.length || !uniqueMonths.length) return {byMonth};

  const monthSet = new Set(uniqueMonths);
  const spans = coalesceMonthRanges(uniqueMonths);

  const buckets = new Map();
  const ensureBucket = (monthKey, userId) => {
    let userMap = buckets.get(monthKey);
    if (!userMap) {
      userMap = new Map();
      buckets.set(monthKey, userMap);
    }
    let entry = userMap.get(userId);
    if (!entry) {
      entry = {
        resolved: 0,
        responses: 0,
        ledgerPoints: 0,
        legacyPoints: 0,
        responseValues: [],
        slaCleanCount: 0,
        onTimeCount: 0,
        onTimeDueCount: 0,
      };
      userMap.set(userId, entry);
    }
    return entry;
  };

  for (const span of spans) {
    const windowRange = {gte: span.gte, lt: span.lt};
    const [resolvedTickets, comments, ledgerRows] = await Promise.all([
      db.ticket.findMany({
        where: {assigneeId: {in: ids}, resolvedAt: windowRange},
        select: {
          id: true,
          assigneeId: true,
          createdAt: true,
          resolvedAt: true,
          firstRespondedAt: true,
          resolutionDueAt: true,
          slaBreaches: true,
          awardedScore: true,
        },
      }),
      db.comment.findMany({
        where: {authorId: {in: ids}, createdAt: windowRange},
        select: {authorId: true, createdAt: true},
      }),
      db.ticketHistory.findMany({
        where: {actorId: {in: ids}, createdAt: windowRange, awardedScore: {not: null}},
        select: {actorId: true, awardedScore: true, createdAt: true},
      }),
    ]);

    const ticketIds = resolvedTickets.map(t => t.id);
    const assignmentRows = ticketIds.length
      ? await db.ticketHistory.findMany({
          where: {ticketId: {in: ticketIds}, action: {contains: 'assign', mode: 'insensitive'}},
          select: {ticketId: true, createdAt: true},
          orderBy: {createdAt: 'asc'},
        })
      : [];
    const assignedAtByTicket = new Map();
    for (const row of assignmentRows) {
      if (!assignedAtByTicket.has(row.ticketId)) assignedAtByTicket.set(row.ticketId, row.createdAt);
    }

    for (const ticket of resolvedTickets) {
      if (!ticket.assigneeId || !ticket.resolvedAt) continue;
      const mKey = toWibMonthKey(ticket.resolvedAt);
      if (!monthSet.has(mKey)) continue;
      const entry = ensureBucket(mKey, ticket.assigneeId);
      entry.resolved += 1;
      entry.legacyPoints += ticket.awardedScore || 0;
      if (Number(ticket.slaBreaches || 0) === 0) entry.slaCleanCount += 1;

      if (ticket.resolutionDueAt) {
        entry.onTimeDueCount += 1;
        if (new Date(ticket.resolvedAt).getTime() <= new Date(ticket.resolutionDueAt).getTime()) {
          entry.onTimeCount += 1;
        }
      }

      if (ticket.firstRespondedAt) {
        const assignedAt = assignedAtByTicket.get(ticket.id) || ticket.createdAt;
        if (assignedAt) {
          const mins = (new Date(ticket.firstRespondedAt).getTime() - new Date(assignedAt).getTime()) / 60000;
          if (Number.isFinite(mins) && mins >= 0) entry.responseValues.push(mins);
        }
      }
    }

    for (const comment of comments) {
      if (!comment.authorId || !comment.createdAt) continue;
      const mKey = toWibMonthKey(comment.createdAt);
      if (!monthSet.has(mKey)) continue;
      ensureBucket(mKey, comment.authorId).responses += 1;
    }

    for (const row of ledgerRows) {
      if (!row.actorId || !row.createdAt) continue;
      const mKey = toWibMonthKey(row.createdAt);
      if (!monthSet.has(mKey)) continue;
      ensureBucket(mKey, row.actorId).ledgerPoints += row.awardedScore || 0;
    }
  }

  for (const mKey of uniqueMonths) {
    const targetMap = byMonth.get(mKey);
    const sourceMap = buckets.get(mKey);
    for (const id of ids) {
      const b = sourceMap?.get(id);
      if (!b) {
        targetMap.set(id, {
          resolved: 0,
          responses: 0,
          points: 0,
          medianResponseMinutes: null,
          p90ResponseMinutes: null,
          responseSampleCount: 0,
          responseValues: [],
          slaCleanCount: 0,
          slaCleanPct: null,
          onTimeCount: 0,
          onTimeDueCount: 0,
          onTimePct: null,
        });
        continue;
      }
      const sortedResp = [...b.responseValues].sort((a, z) => a - z);
      targetMap.set(id, {
        resolved: b.resolved,
        responses: b.responses,
        points: b.ledgerPoints + b.legacyPoints,
        medianResponseMinutes: percentile(sortedResp, 0.5),
        p90ResponseMinutes: percentile(sortedResp, 0.9),
        responseSampleCount: sortedResp.length,
        responseValues: sortedResp,
        slaCleanCount: b.slaCleanCount,
        slaCleanPct: b.resolved > 0 ? round1((b.slaCleanCount / b.resolved) * 100) : null,
        onTimeCount: b.onTimeCount,
        onTimeDueCount: b.onTimeDueCount,
        onTimePct: b.onTimeDueCount > 0 ? round1((b.onTimeCount / b.onTimeDueCount) * 100) : null,
      });
    }
  }

  return {byMonth};
}

/**
 * Scores activity inside each department/company cohort and assigns a competition rank.
 * Volume is normalised against the cohort maximum so small departments are not compared
 * with large ones.
 */
export function scoreActivity(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.departmentId}:${row.company || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const scored = [];
  for (const cohort of groups.values()) {
    const maxPoints = Math.max(0, ...cohort.map(row => row.points || 0));
    const maxResolved = Math.max(0, ...cohort.map(row => row.resolved || 0));
    const maxResponses = Math.max(0, ...cohort.map(row => row.responses || 0));
    const withScores = cohort.map(row => ({
      ...row,
      score: Math.round((0.4 * (maxPoints ? row.points / maxPoints : 0) + 0.35 * (maxResolved ? row.resolved / maxResolved : 0) + 0.25 * (maxResponses ? row.responses / maxResponses : 0)) * 1000) / 10,
    }));
    withScores.sort((left, right) => right.score - left.score || (right.points || 0) - (left.points || 0) || left.userId - right.userId);
    let rank = 0;
    let previous = null;
    withScores.forEach((row, index) => {
      if (row.score !== previous) {
        rank = index + 1;
        previous = row.score;
      }
      scored.push({...row, rank});
    });
  }
  return scored;
}
