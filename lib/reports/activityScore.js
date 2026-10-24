import {jakartaMonthRange} from './monthPeriod.js';

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
