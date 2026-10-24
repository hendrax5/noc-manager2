import {prisma} from '@/lib/prisma';
import {cohortRows} from '@/lib/reports/kinerjaServer';
import {canReadReport} from '@/lib/reports/reportScope';
import {aggregateEvaluations} from '@/lib/reports/monthlyEvaluation';
import {jakartaMonthRange} from '@/lib/reports/monthPeriod';
import {kinerjaAccess,respond,failure} from '../shared';

function reasonsOf(row) {
  const source = row.evidence?.missingReasons?.length ? row.evidence.missingReasons : row.explanations;
  const list = Array.isArray(source) ? source : source ? [source] : [];
  return [...new Set(list.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()))].slice(0, 6);
}

export async function GET(req) {
  try {
    const a = await kinerjaAccess(req);
    const selected = a.users.filter(u => canReadReport(a.scope, u.id));
    const allRows = await cohortRows(prisma, {month: a.month, users: selected, mode: a.mode});
    const rows = allRows.filter(r => (!a.query.get('company') || r.company === a.query.get('company')) && (!a.query.get('departmentId') || String(r.departmentId) === a.query.get('departmentId')));
    const groups = new Map();
    for (const r of rows) {
      const key = r.departmentId + ':' + r.company;
      if (!groups.has(key)) groups.set(key, {departmentId: r.departmentId, department: r.department, company: r.company, rows: []});
      groups.get(key).rows.push(r);
    }
    const publications = await prisma.performancePublication.findMany({where: {monthKey: a.month}, select: {id: true, departmentId: true, company: true, version: true}, orderBy: {version: 'desc'}});
    const range = jakartaMonthRange(a.month);
    const ids = rows.map(r => r.userId);
    const [resolvedRows, commentRows, ledgerRows, legacyRows] = ids.length ? await Promise.all([
      prisma.ticket.groupBy({by: ['assigneeId'], where: {assigneeId: {in: ids}, resolvedAt: range}, _count: {_all: true}}),
      prisma.comment.groupBy({by: ['authorId'], where: {authorId: {in: ids}, createdAt: range}, _count: {_all: true}}),
      prisma.ticketHistory.groupBy({by: ['actorId'], where: {actorId: {in: ids}, createdAt: range}, _sum: {awardedScore: true}}),
      prisma.ticket.groupBy({by: ['assigneeId'], where: {assigneeId: {in: ids}, resolvedAt: range}, _sum: {awardedScore: true}}),
    ]) : [[], [], [], []];
    const resolvedMap = new Map(resolvedRows.map(row => [row.assigneeId, row._count._all]));
    const commentMap = new Map(commentRows.map(row => [row.authorId, row._count._all]));
    const ledgerMap = new Map(ledgerRows.map(row => [row.actorId, row._sum.awardedScore || 0]));
    const legacyMap = new Map(legacyRows.map(row => [row.assigneeId, row._sum.awardedScore || 0]));
    const payloadRows = rows.map(r => ({userId: r.userId, name: r.name, departmentId: r.departmentId, department: r.department, company: r.company, total: r.total, status: r.status, reviewState: r.reviewState, reasons: reasonsOf(r), resolved: resolvedMap.get(r.userId) || 0, responses: commentMap.get(r.userId) || 0, points: (ledgerMap.get(r.userId) || 0) + (legacyMap.get(r.userId) || 0)}));
    const activitySummary = payloadRows.reduce((sum, row) => ({resolved: sum.resolved + row.resolved, responses: sum.responses + row.responses, points: sum.points + row.points}), {resolved: 0, responses: 0, points: 0});
    const reasonCounts = new Map();
    for (const row of payloadRows) for (const reason of row.reasons) reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    const readiness = {
      users: rows.length,
      assigned: rows.filter(r => r.assignmentStable).length,
      withPolicy: rows.filter(r => Boolean(r.policy)).length,
      withContext: rows.filter(r => Number(r.evidence?.scheduledMinutes) > 0).length,
      reviewedActivities: rows.reduce((sum, r) => sum + Number(r.evidence?.coverage?.qualityReviewed || 0), 0),
      ready: rows.filter(r => r.status === 'ready').length,
      insufficient: rows.filter(r => r.status === 'insufficient_data').length,
      excluded: rows.filter(r => r.status === 'excluded').length,
      unpublished: rows.filter(r => r.status === 'unpublished').length,
      topReasons: [...reasonCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 3).map(([text, count]) => ({text, count})),
    };
    return respond({month: a.month, mode: a.mode, currentUserId: Number(a.actor.id), canPublish: a.flags.performance_ranking_publication && a.mode === 'official' && (a.actor.role === 'Admin' || a.actor.permissions?.includes('lock_evaluations')), canViewTeam: selected.some(u => u.id !== Number(a.actor.id)), aggregate: aggregateEvaluations(rows), readiness, activitySummary, groups: [...groups.values()].map(g => ({...g, rows: undefined, ...aggregateEvaluations(g.rows), publicationVersion: publications.find(p => p.departmentId === g.departmentId && p.company === g.company)?.version || 0})), rows: payloadRows, departments: [...new Map(allRows.map(r => [r.departmentId, {id: r.departmentId, name: r.department}])).values()], companies: [...new Set(allRows.map(r => r.company).filter(Boolean))]});
  } catch (e) {
    return failure(e);
  }
}
