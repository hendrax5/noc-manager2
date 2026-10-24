import {prisma} from '@/lib/prisma';
import {cohortRows} from '@/lib/reports/kinerjaServer';
import {canReadReport} from '@/lib/reports/reportScope';
import {aggregateEvaluations} from '@/lib/reports/monthlyEvaluation';
import {loadActivityMetrics,scoreActivity} from '@/lib/reports/activityScore';
import {previousMonthKey} from '@/lib/reports/monthPeriod';
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
    const metrics = await loadActivityMetrics(prisma, {userIds: rows.map(r => r.userId), month: a.month});
    const payloadRows = scoreActivity(rows.map(r => ({userId: r.userId, name: r.name, departmentId: r.departmentId, department: r.department, company: r.company, total: r.total, status: r.status, reviewState: r.reviewState, reasons: reasonsOf(r), ...(metrics.get(r.userId) || {resolved: 0, responses: 0, points: 0})})));
    const activitySummary = payloadRows.reduce((sum, row) => ({resolved: sum.resolved + row.resolved, responses: sum.responses + row.responses, points: sum.points + row.points}), {resolved: 0, responses: 0, points: 0});
    const previousMonth = previousMonthKey(a.month);
    const previousMetrics = await loadActivityMetrics(prisma, {userIds: rows.map(r => r.userId), month: previousMonth});
    const previousRows = scoreActivity(rows.map(r => ({userId: r.userId, departmentId: r.departmentId, company: r.company, ...(previousMetrics.get(r.userId) || {resolved: 0, responses: 0, points: 0})})));
    const previousById = new Map(previousRows.map(row => [row.userId, row]));
    const byGroup = new Map();
    for (const row of payloadRows) {
      const key = row.departmentId + ':' + (row.company || '');
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key).push(row);
    }
    const average = values => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : 0;
    const perMember = (list, field) => list.length ? Math.round(list.reduce((sum, row) => sum + (row[field] || 0), 0) / list.length * 10) / 10 : 0;
    const comparison = [...byGroup.values()].map(members => {
      const previousMembers = members.map(member => previousById.get(member.userId)).filter(Boolean);
      const currentScore = average(members.map(member => member.score || 0));
      const previousScore = average(previousMembers.map(member => member.score || 0));
      const currentPoints = perMember(members, 'points');
      const previousPoints = perMember(previousMembers, 'points');
      return {
        departmentId: members[0].departmentId,
        department: members[0].department,
        company: members[0].company,
        members: members.length,
        activeMembers: members.filter(member => (member.score || 0) > 0).length,
        currentScore,
        previousScore,
        scoreDelta: Math.round((currentScore - previousScore) * 10) / 10,
        currentPoints,
        previousPoints,
        pointsDelta: Math.round((currentPoints - previousPoints) * 10) / 10,
        currentResolved: perMember(members, 'resolved'),
        previousResolved: perMember(previousMembers, 'resolved'),
        resolvedDelta: Math.round((perMember(members, 'resolved') - perMember(previousMembers, 'resolved')) * 10) / 10,
        previousActive: previousMembers.filter(member => (member.score || 0) > 0).length,
      };
    }).sort((left, right) => right.scoreDelta - left.scoreDelta);
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
    return respond({month: a.month, previousMonth, mode: a.mode, currentUserId: Number(a.actor.id), canPublish: a.flags.performance_ranking_publication && a.mode === 'official' && (a.actor.role === 'Admin' || a.actor.permissions?.includes('lock_evaluations')), canViewTeam: selected.some(u => u.id !== Number(a.actor.id)), aggregate: aggregateEvaluations(rows), readiness, activitySummary, comparison, groups: [...groups.values()].map(g => ({...g, rows: undefined, ...aggregateEvaluations(g.rows), publicationVersion: publications.find(p => p.departmentId === g.departmentId && p.company === g.company)?.version || 0})), rows: payloadRows, departments: [...new Map(allRows.map(r => [r.departmentId, {id: r.departmentId, name: r.department}])).values()], companies: [...new Set(allRows.map(r => r.company).filter(Boolean))]});
  } catch (e) {
    return failure(e);
  }
}
